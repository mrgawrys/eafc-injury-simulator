import { FatigueService } from './fatigue';

describe('FatigueService', () => {
  let service: FatigueService;

  beforeEach(() => {
    service = new FatigueService();
  });

  describe('getMultiplier', () => {
    it('should return 0.85 for fresh players (0-25)', () => {
      expect(service.getMultiplier(0)).toBe(0.85);
      expect(service.getMultiplier(25)).toBe(0.85);
    });

    it('should return 1.0 for normal fatigue (26-50)', () => {
      expect(service.getMultiplier(26)).toBe(1.0);
      expect(service.getMultiplier(50)).toBe(1.0);
    });

    it('should return 1.25 for fatigued players (51-70)', () => {
      expect(service.getMultiplier(51)).toBe(1.25);
      expect(service.getMultiplier(70)).toBe(1.25);
    });

    it('should return 1.5 for high risk players (71-85)', () => {
      expect(service.getMultiplier(71)).toBe(1.5);
      expect(service.getMultiplier(85)).toBe(1.5);
    });

    it('should return 2.0 for extreme fatigue (86-100)', () => {
      expect(service.getMultiplier(86)).toBe(2.0);
      expect(service.getMultiplier(100)).toBe(2.0);
    });
  });

  describe('decayFatigue', () => {
    it('should decay by 3 per day', () => {
      expect(service.decayFatigue(30, 1)).toBe(27);
      expect(service.decayFatigue(30, 3)).toBe(21);
    });

    it('should not go below 0', () => {
      expect(service.decayFatigue(5, 10)).toBe(0);
    });
  });

  describe('addBackgroundLeagueLoad', () => {
    it('should add 5 fatigue for every 3 days elapsed', () => {
      expect(service.addBackgroundLeagueLoad(20, 3)).toBe(25);
      expect(service.addBackgroundLeagueLoad(20, 6)).toBe(30);
    });

    it('should not add for fewer than 3 days', () => {
      expect(service.addBackgroundLeagueLoad(20, 2)).toBe(20);
    });

    it('should not exceed 100', () => {
      expect(service.addBackgroundLeagueLoad(98, 6)).toBe(100);
    });
  });

  describe('applyMatchLoad', () => {
    it('should add 15 for starters', () => {
      expect(service.applyMatchLoad(20, 'starter')).toBe(35);
    });

    it('should add 8 for subs', () => {
      expect(service.applyMatchLoad(20, 'sub')).toBe(28);
    });

    it('should not change for rested', () => {
      expect(service.applyMatchLoad(20, 'rested')).toBe(20);
    });

    it('should cap at 100', () => {
      expect(service.applyMatchLoad(95, 'starter')).toBe(100);
    });
  });

  describe('getReturnFromInjuryFatigue', () => {
    it('should return value between 40 and 50', () => {
      const val = service.getReturnFromInjuryFatigue();
      expect(val).toBeGreaterThanOrEqual(40);
      expect(val).toBeLessThanOrEqual(50);
    });
  });

  describe('getBadge', () => {
    it('should return "fresh" for 0-25', () => {
      expect(service.getBadge(10)).toBe('fresh');
    });

    it('should return null for 26-50', () => {
      expect(service.getBadge(35)).toBeNull();
    });

    it('should return "fatigued" for 51-70', () => {
      expect(service.getBadge(60)).toBe('fatigued');
    });

    it('should return "high-risk" for 71+', () => {
      expect(service.getBadge(75)).toBe('high-risk');
      expect(service.getBadge(90)).toBe('high-risk');
    });
  });

  describe('updateFatigueForDays', () => {
    it('should decay fatigue and add background load over a range', () => {
      const fatigue: Record<string, number> = { p1: 50, p2: 20 };
      const result = service.updateFatigueForDays(fatigue, 6);
      // 6 days: decay 6*3=18, background floor(6/3)*5=10
      // p1: 50 - 18 + 10 = 42
      // p2: 20 - 18 + 10 = 12
      expect(result['p1']).toBe(42);
      expect(result['p2']).toBe(12);
    });
  });
});
