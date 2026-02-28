import { TestBed } from '@angular/core/testing';
import { SimulationService } from './simulation';
import { FatigueService } from './fatigue';
import type { Player } from '../models/player';

const makePlayer = (name: string, injuriesPerSeason = 1.0): Player => ({
  name,
  position: 'FW',
  age: 25,
  injuryProfile: {
    injuriesPerSeason,
    avgDaysMissed: 10,
    stdDevDaysMissed: 3,
    injuryTypeWeights: { 'Muscle Injury': 1.0 },
  },
});

describe('SimulationService', () => {
  let service: SimulationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SimulationService, FatigueService],
    });
    service = TestBed.inject(SimulationService);
  });

  it('should work without fatigue (backwards compatible)', () => {
    const players = [makePlayer('P1', 0)];
    const result = service.simulateDay(players, [], 'Team', '2025-01-01');
    expect(result).toBeDefined();
    expect(result.updatedFatigue).toBeUndefined();
  });

  it('should accept playerFatigue and apply multiplier', () => {
    const players = [makePlayer('P1', 0.5)];
    const fatigue = { Team__P1: 10 };
    const result = service.simulateDay(players, [], 'Team', '2025-01-01', fatigue);
    expect(result).toBeDefined();
  });

  it('should update fatigue over simulateRange', () => {
    const players = [makePlayer('P1', 0)];
    const fatigue = { Team__P1: 50 };
    const result = service.simulateRange(players, [], 'Team', '2025-01-01', '2025-01-07', fatigue);
    // 7 days: decay 7*3=21, background floor(7/3)*5=10 => 50-21+10=39
    expect(result.updatedFatigue).toBeDefined();
    expect(result.updatedFatigue!['Team__P1']).toBe(39);
  });

  it('should return undefined updatedFatigue when no fatigue passed', () => {
    const players = [makePlayer('P1', 0)];
    const result = service.simulateRange(players, [], 'Team', '2025-01-01', '2025-01-07');
    expect(result.updatedFatigue).toBeUndefined();
  });

  it('should set return-from-injury fatigue on recovery', () => {
    const players = [makePlayer('P1', 0)];
    const injuries = [
      {
        playerId: 'Team__P1',
        playerName: 'P1',
        type: 'Muscle Injury',
        startDate: '2024-12-25',
        returnDate: '2025-01-03',
        daysMissed: 9,
      },
    ];
    const fatigue = { Team__P1: 0 };
    const result = service.simulateRange(
      players,
      injuries,
      'Team',
      '2025-01-01',
      '2025-01-07',
      fatigue
    );
    // Player recovers on Jan 3, gets 40-50 fatigue, then some decay
    expect(result.updatedFatigue!['Team__P1']).toBeGreaterThan(0);
  });
});
