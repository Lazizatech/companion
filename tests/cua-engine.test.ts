import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedCUAEngine, CUAConfig, TaskResult } from '../src/cua/unified-engine';
import { createDB } from '../src/db';
import { chromium } from 'playwright';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                action: 'navigate',
                target: 'https://example.com',
                confidence: 0.95,
                reasoning: 'Test navigation'
              })
            }
          }]
        })
      }
    }
  }))
}));

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        addInitScript: vi.fn(),
        newPage: vi.fn().mockResolvedValue({
          url: vi.fn().mockReturnValue('https://example.com'),
          title: vi.fn().mockResolvedValue('Example Page'),
          goto: vi.fn(),
          waitForSelector: vi.fn(),
          click: vi.fn(),
          type: vi.fn(),
          keyboard: {
            press: vi.fn()
          },
          evaluate: vi.fn(),
          waitForTimeout: vi.fn(),
          $: vi.fn(),
          screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
          waitUntil: vi.fn()
        }),
        close: vi.fn()
      })
    })
  }
}));

describe('UnifiedCUAEngine', () => {
  let engine: UnifiedCUAEngine;
  let mockDB: any;
  let mockD1: any;

  beforeEach(() => {
    // Mock D1 database
    mockD1 = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn(),
          all: vi.fn().mockResolvedValue([])
        })
      })
    };

    mockDB = createDB(mockD1 as any);
    
    // Mock database operations
    vi.spyOn(mockDB, 'insert').mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined)
    } as any);
    
    vi.spyOn(mockDB, 'update').mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })
    } as any);
    
    vi.spyOn(mockDB, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([])
        })
      })
    } as any);

    const config: CUAConfig = {
      headless: true,
      useVision: true,
      timeout: 5000
    };

    engine = new UnifiedCUAEngine(mockDB, 'test-agent-id', config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(engine).toBeInstanceOf(UnifiedCUAEngine);
    });

    it('should initialize browser and AI client', async () => {
      await engine.init();
      
      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        args: expect.arrayContaining([
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox'
        ])
      });
    });

    it('should not reinitialize if already initialized', async () => {
      await engine.init();
      await engine.init();
      
      expect(chromium.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task Execution', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should execute navigation task successfully', async () => {
      const result: TaskResult = await engine.executeTask('Go to https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('navigate');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle task execution errors', async () => {
      // Mock AI to throw error
      const mockOpenAI = require('openai').default;
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('AI Error'))
          }
        }
      }));

      const result: TaskResult = await engine.executeTask('Invalid task');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('AI Error');
    });

    it('should update agent status during task execution', async () => {
      await engine.executeTask('Test task');
      
      expect(mockDB.update).toHaveBeenCalled();
    });

    it('should save task results to database', async () => {
      await engine.executeTask('Test task');
      
      expect(mockDB.insert).toHaveBeenCalled();
    });
  });

  describe('Browser Actions', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should navigate to URL', async () => {
      await engine.navigate('https://example.com');
      
      const mockPage = (chromium.launch as any).mock.results[0].value
        .newContext.mock.results[0].value
        .newPage.mock.results[0].value;
      
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 5000
      });
    });

    it('should click on element', async () => {
      await engine.click('#test-button');
      
      const mockPage = (chromium.launch as any).mock.results[0].value
        .newContext.mock.results[0].value
        .newPage.mock.results[0].value;
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#test-button', {
        timeout: 5000
      });
      expect(mockPage.click).toHaveBeenCalledWith('#test-button', {
        delay: expect.any(Number)
      });
    });

    it('should type text into input', async () => {
      await engine.type('#search-input', 'test query');
      
      const mockPage = (chromium.launch as any).mock.results[0].value
        .newContext.mock.results[0].value
        .newPage.mock.results[0].value;
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#search-input', {
        timeout: 5000
      });
      expect(mockPage.click).toHaveBeenCalledWith('#search-input', {
        clickCount: 3
      });
    });

    it('should take screenshot', async () => {
      const screenshot = await engine.screenshot();
      
      expect(screenshot).toBe('fake-screenshot');
      
      const mockPage = (chromium.launch as any).mock.results[0].value
        .newContext.mock.results[0].value
        .newPage.mock.results[0].value;
      
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        fullPage: true
      });
    });

    it('should scroll page', async () => {
      await engine.scroll('down');
      
      const mockPage = (chromium.launch as any).mock.results[0].value
        .newContext.mock.results[0].value
        .newPage.mock.results[0].value;
      
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should search for content', async () => {
      // Mock page.$ to return a search input
      const mockPage = (chromium.launch as any).mock.results[0].value
        .newContext.mock.results[0].value
        .newPage.mock.results[0].value;
      
      mockPage.$.mockResolvedValue('input[name="q"]');
      
      await engine.search('test query');
      
      expect(mockPage.$.mock.calls.length).toBeGreaterThan(0);
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should get memory from database', async () => {
      const memory = await engine.getMemory();
      
      expect(mockDB.select).toHaveBeenCalled();
      expect(Array.isArray(memory)).toBe(true);
    });

    it('should save memory to database', async () => {
      await engine.saveMemory('behavior_patterns', { pattern: 'test' });
      
      expect(mockDB.insert).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should close browser and update status', async () => {
      await engine.init();
      await engine.close();
      
      const mockBrowser = (chromium.launch as any).mock.results[0].value;
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(mockDB.update).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customConfig: CUAConfig = {
        headless: false,
        useVision: false,
        timeout: 10000,
        userAgent: 'Custom User Agent',
        model: 'custom-model',
        visionModel: 'custom-vision-model'
      };

      const customEngine = new UnifiedCUAEngine(mockDB, 'test-agent', customConfig);
      expect(customEngine).toBeInstanceOf(UnifiedCUAEngine);
    });
  });

  describe('Error Handling', () => {
    it('should handle browser initialization errors', async () => {
      (chromium.launch as any).mockRejectedValue(new Error('Browser error'));
      
      await expect(engine.init()).rejects.toThrow('Browser error');
    });

    it('should handle page operation errors', async () => {
      await engine.init();
      
      const mockPage = (chromium.launch as any).mock.results[0].value
        .newContext.mock.results[0].value
        .newPage.mock.results[0].value;
      
      mockPage.goto.mockRejectedValue(new Error('Navigation error'));
      
      await expect(engine.navigate('https://example.com')).rejects.toThrow('Navigation error');
    });
  });
});
