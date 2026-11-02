import { describe, expect, it } from 'vitest';
import { welcomePlan, type WelcomeAnswer, type WelcomePlan } from './plan';

describe('welcomePlan', () => {
  it.each<[string, WelcomeAnswer, WelcomePlan]>([
    [
      'a beginner learning CFOP lands in its guide',
      { canSolve: false, method: 'cfop' },
      { showLearn: true, guide: 'cfop', trainerSetId: null, sessionMethod: 'cfop', screen: 'learn' },
    ],
    [
      'a beginner learning Roux lands in the Roux guide, timing Roux',
      { canSolve: false, method: 'roux' },
      { showLearn: true, guide: 'roux', trainerSetId: null, sessionMethod: 'roux', screen: 'learn' },
    ],
    [
      'a CFOP solver lands in the trainer on OLL, without the guide on the bar',
      { canSolve: true, method: 'cfop' },
      { showLearn: false, guide: 'cfop', trainerSetId: 'oll', sessionMethod: 'cfop', screen: 'trainer' },
    ],
    [
      'a Roux solver lands on CMLL',
      { canSolve: true, method: 'roux' },
      { showLearn: false, guide: 'roux', trainerSetId: 'cmll', sessionMethod: 'roux', screen: 'trainer' },
    ],
    [
      'a ZZ solver lands on the timer, the trainer having no ZZ sets yet',
      { canSolve: true, method: 'zz' },
      { showLearn: false, guide: 'zz', trainerSetId: null, sessionMethod: 'zz', screen: 'timer' },
    ],
    [
      'a solver who does not know the name is set up for CFOP',
      { canSolve: true, method: null },
      { showLearn: false, guide: 'cfop', trainerSetId: 'oll', sessionMethod: 'cfop', screen: 'trainer' },
    ],
  ])('%s', (_name, answer, plan) => {
    expect(welcomePlan(answer)).toEqual(plan);
  });
});
