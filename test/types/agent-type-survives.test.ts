import { describe, it, expect } from 'vitest';
import { SaveRunInputSchema, UpdateRunInputSchema } from '../../src/types/schemas.js';
import { AnalysisRecordResponseSchema } from '../../src/types/response-schemas.js';

describe('F02 analysis type contracts', () => {
  const analysis = {
    analysisRecords: [{ agentName: 'map', agentType: 'explorer', recordType: 'custom_map', recordId: 'm', title: 'Map', data: {} }],
    analysisSummary: [{ agentName: 'check', agentType: 'validator', decision: 'PASS' }],
  };
  it('retains explicit types through save and update validation', () => {
    const save = SaveRunInputSchema.parse({ project: 'p', workflowType: 'w', agents: [{ name: 'map', decision: 'TRACED' }], recommendations: [], ...analysis });
    expect(save.analysisRecords).toEqual(analysis.analysisRecords);
    expect(save.analysisSummary).toEqual(analysis.analysisSummary);
    const update = UpdateRunInputSchema.parse(analysis);
    expect(update.analysisRecords).toEqual(analysis.analysisRecords);
    expect(update.analysisSummary).toEqual(analysis.analysisSummary);
  });
  it('rejects unsupported explicit types without constraining custom record types', () => {
    expect(UpdateRunInputSchema.safeParse({ analysisRecords: [{ ...analysis.analysisRecords[0], agentType: 'guess' }] }).success).toBe(false);
  });
  it('retains provenance, exact version and unknown while accepting older responses', () => {
    const row = { id: '00000000-0000-4000-8000-000000000001', runId: '00000000-0000-4000-8000-000000000002', agentName: 'map', agentType: 'unknown', recordType: 'custom_map', recordId: 'm', title: 'Map', classification: null, severity: null, recordData: {}, createdAt: '2026-09-18T00:00:00.000Z' };
    expect(AnalysisRecordResponseSchema.parse(row)).toEqual(row);
    expect(AnalysisRecordResponseSchema.parse({ ...row, agentTypeSource: 'registry', agentTypeDefinitionId: row.id, agentTypeDefinitionVersion: '1.0.0' })).toMatchObject({ agentTypeSource: 'registry', agentTypeDefinitionVersion: '1.0.0' });
  });
});
