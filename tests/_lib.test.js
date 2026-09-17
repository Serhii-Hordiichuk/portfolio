import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as lib from '../api/_lib.js';

describe('api/_lib.js', () => {
  describe('detectIntent', () => {
    it('returns "site" for Ukrainian queries about Serhii', () => {
      const messages = [{ role: 'user', content: 'Хто такий Сергій Гордійчук?' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "site" for English queries about Serhii', () => {
      const messages = [{ role: 'user', content: 'Who is Serhii Hordiichuk?' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "site" for CV/resume queries', () => {
      const messages = [{ role: 'user', content: 'Show me your CV' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "site" for portfolio queries', () => {
      const messages = [{ role: 'user', content: 'What is in your portfolio?' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "site" for skills queries', () => {
      const messages = [{ role: 'user', content: 'What are your skills?' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "site" for education/experience queries', () => {
      const messages = [{ role: 'user', content: 'What is your education and experience?' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "site" for contact queries', () => {
      const messages = [{ role: 'user', content: 'Ваші контакти?' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "site" for language/hobby queries', () => {
      const messages = [{ role: 'user', content: 'Ваші хобі?' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "site" for plumber/Sniatyn queries', () => {
      const messages = [{ role: 'user', content: 'Tell me about your plumbing work in Sniatyn' }];
      expect(lib.detectIntent(messages)).toBe('site');
    });

    it('returns "general" for coding questions', () => {
      const messages = [{ role: 'user', content: 'How to write a React component?' }];
      expect(lib.detectIntent(messages)).toBe('general');
    });

    it('returns "general" for math questions', () => {
      const messages = [{ role: 'user', content: 'What is 2 + 2?' }];
      expect(lib.detectIntent(messages)).toBe('general');
    });

    it('returns "general" for creative writing', () => {
      const messages = [{ role: 'user', content: 'Write a poem about cats' }];
      expect(lib.detectIntent(messages)).toBe('general');
    });

    it('returns "general" for empty messages', () => {
      const messages = [];
      expect(lib.detectIntent(messages)).toBe('general');
    });

    it('returns "general" for non-user messages', () => {
      const messages = [{ role: 'assistant', content: 'Hello!' }];
      expect(lib.detectIntent(messages)).toBe('general');
    });

    it('checks last user message only', () => {
      const messages = [
        { role: 'user', content: 'Who are you?' },
        { role: 'assistant', content: 'I am an AI' },
        { role: 'user', content: 'How to code in Python?' }
      ];
      expect(lib.detectIntent(messages)).toBe('general');
    });

    it('handles messages without content gracefully', () => {
      const messages = [{ role: 'user', content: null }];
      expect(lib.detectIntent(messages)).toBe('general');
    });

    it('handles non-string content gracefully', () => {
      const messages = [{ role: 'user', content: 123 }];
      expect(lib.detectIntent(messages)).toBe('general');
    });
  });

  describe('buildKB', () => {
    it('includes base knowledge in output', () => {
      const kb = lib.buildKB('', [], 'general');
      expect(kb).toContain('Serhii Hordiichuk');
      expect(kb).toContain('DUAL MODE');
    });

    it('includes extra context when provided', () => {
      const kb = lib.buildKB('Extra context here', [], 'general');
      expect(kb).toContain('LIVE PAGE SNAPSHOT');
      expect(kb).toContain('Extra context here');
    });

    it('truncates extra context to 4000 chars', () => {
      const longExtra = 'x'.repeat(5000);
      const kb = lib.buildKB(longExtra, [], 'general');
      // KB includes base knowledge (~1000 chars) + system prompt (~1500 chars) + extra (4000 chars) + mode
      // So total should be less than 5000 + 3000 = 8000
      expect(kb).not.toContain('x'.repeat(5000));
      expect(kb.length).toBeLessThan(8000);
    });

    it('includes site intent mode for "site" intent', () => {
      const kb = lib.buildKB('', [], 'site');
      expect(kb).toContain('INTENT: the user is asking about Serhii or this site');
      expect(kb).toContain('do NOT invent');
    });

    it('includes general intent mode for "general" intent', () => {
      const kb = lib.buildKB('', [], 'general');
      expect(kb).toContain('INTENT: general topic');
      expect(kb).toContain('answer freely like ChatGPT');
    });

    it('includes file attachments in output', () => {
      const attachments = [
        { name: 'test.txt', text: 'File content here' },
        { name: 'image.png', image: 'data:image/png;base64,abc123' }
      ];
      const kb = lib.buildKB('', attachments, 'general');
      expect(kb).toContain('Attached files:');
      expect(kb).toContain('test.txt');
      expect(kb).toContain('File content here');
      expect(kb).toContain('User sent images:');
      expect(kb).toContain('image.png');
    });

    it('limits attachments to 3 files', () => {
      const attachments = Array.from({ length: 5 }, (_, i) => ({
        name: `file${i}.txt`,
        text: `Content ${i}`
      }));
      const kb = lib.buildKB('', attachments, 'general');
      expect(kb).toContain('file0.txt');
      expect(kb).toContain('file2.txt');
      expect(kb).not.toContain('file4.txt');
    });

    it('truncates file text to 3000 chars', () => {
      const longText = 'x'.repeat(4000);
      const attachments = [{ name: 'big.txt', text: longText }];
      const kb = lib.buildKB('', attachments, 'general');
      expect(kb).not.toContain('x'.repeat(4000));
    });

    it('handles empty attachments array', () => {
      const kb = lib.buildKB('', [], 'general');
      expect(kb).not.toContain('Attached files:');
    });

    it('handles null/undefined attachments', () => {
      const kb = lib.buildKB('', null, 'general');
      expect(kb).not.toContain('Attached files:');
    });
  });

  describe('buildLLMMessages', () => {
    it('returns messages unchanged when no images', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      const result = lib.buildLLMMessages(messages, []);
      expect(result.messages).toEqual(messages);
      expect(result.ollamaImages).toEqual([]);
    });

    it('handles empty messages array', () => {
      const result = lib.buildLLMMessages([], []);
      expect(result.messages).toEqual([]);
      expect(result.ollamaImages).toEqual([]);
    });

    it('handles null/undefined messages', () => {
      const result = lib.buildLLMMessages(null, []);
      expect(result.messages).toEqual([]);
      expect(result.ollamaImages).toEqual([]);
    });

    it('converts last user message to multimodal when images attached', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Analyze this image' }
      ];
      const attachments = [
        { name: 'image1.png', image: 'data:image/png;base64,abc123' },
        { name: 'image2.jpg', image: 'data:image/jpeg;base64,def456' }
      ];
      const result = lib.buildLLMMessages(messages, attachments);
      
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: 'system', content: 'System prompt' });
      expect(result.messages[1].role).toBe('user');
      expect(Array.isArray(result.messages[1].content)).toBe(true);
      expect(result.messages[1].content).toHaveLength(3); // text + 2 images
      expect(result.messages[1].content[0]).toEqual({ type: 'text', text: 'Analyze this image' });
      expect(result.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } });
      expect(result.messages[1].content[2]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,def456' } });
    });

    it('limits images to 2', () => {
      const messages = [{ role: 'user', content: 'Look at these' }];
      const attachments = [
        { name: 'img1.png', image: 'data:image/png;base64,1' },
        { name: 'img2.png', image: 'data:image/png;base64,2' },
        { name: 'img3.png', image: 'data:image/png;base64,3' }
      ];
      const result = lib.buildLLMMessages(messages, attachments);
      expect(result.messages[0].content).toHaveLength(3); // text + 2 images
      expect(result.ollamaImages).toHaveLength(2);
    });

    it('extracts base64 for ollamaImages', () => {
      const messages = [{ role: 'user', content: 'Image' }];
      const attachments = [
        { name: 'img.png', image: 'data:image/png;base64,abc123' }
      ];
      const result = lib.buildLLMMessages(messages, attachments);
      expect(result.ollamaImages).toEqual(['abc123']);
    });

    it('does not modify messages when last message is not user', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ];
      const attachments = [{ name: 'img.png', image: 'data:image/png;base64,abc123' }];
      const result = lib.buildLLMMessages(messages, attachments);
      expect(result.messages).toEqual(messages);
      expect(result.ollamaImages).toEqual([]);
    });

    it('handles attachments without images', () => {
      const messages = [{ role: 'user', content: 'Read this file' }];
      const attachments = [{ name: 'doc.txt', text: 'File content' }];
      const result = lib.buildLLMMessages(messages, attachments);
      expect(result.messages).toEqual(messages);
      expect(result.ollamaImages).toEqual([]);
    });

    it('handles null/undefined attachments', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = lib.buildLLMMessages(messages, null);
      expect(result.messages).toEqual(messages);
      expect(result.ollamaImages).toEqual([]);
    });
  });

  describe('ollamaBase', () => {
    it('returns URL without trailing slash', () => {
      expect(lib.ollamaBase('http://localhost:11434/')).toBe('http://localhost:11434');
      expect(lib.ollamaBase('http://localhost:11434')).toBe('http://localhost:11434');
    });

    it('falls back to environment variable', () => {
      process.env.OLLAMA_URL = 'http://env:11434/';
      expect(lib.ollamaBase('')).toBe('http://env:11434');
      delete process.env.OLLAMA_URL;
    });

    it('returns empty string when no URL provided', () => {
      expect(lib.ollamaBase('')).toBe('');
    });
  });

  describe('ollamaModel', () => {
    it('returns provided model name', () => {
      expect(lib.ollamaModel('llama3:8b')).toBe('llama3:8b');
    });

    it('falls back to environment variable', () => {
      process.env.OLLAMA_MODEL = 'mistral:7b';
      expect(lib.ollamaModel('')).toBe('mistral:7b');
      delete process.env.OLLAMA_MODEL;
    });

    it('defaults to llama3.1:8b', () => {
      expect(lib.ollamaModel('')).toBe('llama3.1:8b');
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('allows first request', () => {
      const result = lib.checkRateLimit('test-key', { windowMs: 60000, maxRequests: 10, keyPrefix: 'test' });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('allows requests up to maxRequests', () => {
      for (let i = 0; i < 10; i++) {
        const result = lib.checkRateLimit('test-key-2', { windowMs: 60000, maxRequests: 10, keyPrefix: 'test' });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9 - i);
      }
    });

    it('blocks requests exceeding maxRequests', () => {
      for (let i = 0; i < 10; i++) {
        lib.checkRateLimit('test-key-3', { windowMs: 60000, maxRequests: 10, keyPrefix: 'test' });
      }
      const result = lib.checkRateLimit('test-key-3', { windowMs: 60000, maxRequests: 10, keyPrefix: 'test' });
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('resets after window expires', () => {
      for (let i = 0; i < 10; i++) {
        lib.checkRateLimit('test-key-4', { windowMs: 60000, maxRequests: 10, keyPrefix: 'test' });
      }
      vi.advanceTimersByTime(61000);
      const result = lib.checkRateLimit('test-key-4', { windowMs: 60000, maxRequests: 10, keyPrefix: 'test' });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('tracks different keys separately', () => {
      lib.checkRateLimit('key-a', { windowMs: 60000, maxRequests: 2, keyPrefix: 'test' });
      lib.checkRateLimit('key-a', { windowMs: 60000, maxRequests: 2, keyPrefix: 'test' });
      const resultA = lib.checkRateLimit('key-a', { windowMs: 60000, maxRequests: 2, keyPrefix: 'test' });
      expect(resultA.allowed).toBe(false);

      const resultB = lib.checkRateLimit('key-b', { windowMs: 60000, maxRequests: 2, keyPrefix: 'test' });
      expect(resultB.allowed).toBe(true);
      expect(resultB.remaining).toBe(1);
    });
  });

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const req = { headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' } };
      expect(lib.getClientIp(req)).toBe('192.168.1.1');
    });

    it('uses x-real-ip when x-forwarded-for not present', () => {
      const req = { headers: { 'x-real-ip': '192.168.1.2' } };
      expect(lib.getClientIp(req)).toBe('192.168.1.2');
    });

    it('falls back to socket remoteAddress', () => {
      const req = { headers: {}, socket: { remoteAddress: '192.168.1.3' } };
      expect(lib.getClientIp(req)).toBe('192.168.1.3');
    });

    it('returns unknown when no IP available', () => {
      const req = { headers: {}, socket: {} };
      expect(lib.getClientIp(req)).toBe('unknown');
    });
  });
});