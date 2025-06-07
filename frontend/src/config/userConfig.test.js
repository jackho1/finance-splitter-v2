import { USER_CONFIG } from './userConfig';

describe('User Configuration', () => {
  test('should have all required configuration properties', () => {
    expect(USER_CONFIG).toHaveProperty('PRIMARY_USER_1');
    expect(USER_CONFIG).toHaveProperty('PRIMARY_USER_2');
    expect(USER_CONFIG).toHaveProperty('BOTH_LABEL');
    expect(USER_CONFIG).toHaveProperty('DEFAULT_LABELS');
  });

  test('should have string values for user names', () => {
    expect(typeof USER_CONFIG.PRIMARY_USER_1).toBe('string');
    expect(typeof USER_CONFIG.PRIMARY_USER_2).toBe('string');
    expect(typeof USER_CONFIG.BOTH_LABEL).toBe('string');
  });

  test('should have non-empty string values', () => {
    expect(USER_CONFIG.PRIMARY_USER_1.trim()).toBeTruthy();
    expect(USER_CONFIG.PRIMARY_USER_2.trim()).toBeTruthy();
    expect(USER_CONFIG.BOTH_LABEL.trim()).toBeTruthy();
  });

  test('should have unique user names', () => {
    expect(USER_CONFIG.PRIMARY_USER_1).not.toBe(USER_CONFIG.PRIMARY_USER_2);
    expect(USER_CONFIG.PRIMARY_USER_1).not.toBe(USER_CONFIG.BOTH_LABEL);
    expect(USER_CONFIG.PRIMARY_USER_2).not.toBe(USER_CONFIG.BOTH_LABEL);
  });

  test('should have DEFAULT_LABELS as an array', () => {
    expect(Array.isArray(USER_CONFIG.DEFAULT_LABELS)).toBe(true);
  });

  test('should have DEFAULT_LABELS containing all users', () => {
    const defaultLabels = USER_CONFIG.DEFAULT_LABELS;
    
    expect(defaultLabels).toContain(USER_CONFIG.PRIMARY_USER_1);
    expect(defaultLabels).toContain(USER_CONFIG.PRIMARY_USER_2);
    expect(defaultLabels).toContain(USER_CONFIG.BOTH_LABEL);
  });

  test('should have DEFAULT_LABELS in the correct order', () => {
    const expectedOrder = [
      USER_CONFIG.PRIMARY_USER_1,
      USER_CONFIG.PRIMARY_USER_2,
      USER_CONFIG.BOTH_LABEL
    ];
    
    expect(USER_CONFIG.DEFAULT_LABELS).toEqual(expectedOrder);
  });

  test('should have DEFAULT_LABELS with exactly 3 elements', () => {
    expect(USER_CONFIG.DEFAULT_LABELS).toHaveLength(3);
  });

  test('should have expected default values', () => {
    // Test current default values, but this can be updated if config changes
    expect(USER_CONFIG.PRIMARY_USER_1).toBe('Ruby');
    expect(USER_CONFIG.PRIMARY_USER_2).toBe('Jack');
    expect(USER_CONFIG.BOTH_LABEL).toBe('Both');
  });

  test('should maintain object structure integrity', () => {
    // Test that config has the expected structure
    const originalValue = USER_CONFIG.PRIMARY_USER_1;
    const originalLabels = [...USER_CONFIG.DEFAULT_LABELS];
    
    // Verify the original values are as expected
    expect(originalValue).toBe('Ruby');
    expect(originalLabels).toEqual(['Ruby', 'Jack', 'Both']);
    
    // Test that the object structure is consistent
    expect(USER_CONFIG.DEFAULT_LABELS[0]).toBe(USER_CONFIG.PRIMARY_USER_1);
    expect(USER_CONFIG.DEFAULT_LABELS[1]).toBe(USER_CONFIG.PRIMARY_USER_2);
    expect(USER_CONFIG.DEFAULT_LABELS[2]).toBe(USER_CONFIG.BOTH_LABEL);
  });

  test('should maintain consistency across all label references', () => {
    // Ensure that all references to labels use the same values
    const allLabelsFromConfig = [
      USER_CONFIG.PRIMARY_USER_1,
      USER_CONFIG.PRIMARY_USER_2,
      USER_CONFIG.BOTH_LABEL
    ];
    
    // Check for duplicates
    const uniqueLabels = [...new Set(allLabelsFromConfig)];
    expect(uniqueLabels).toHaveLength(allLabelsFromConfig.length);
    
    // Ensure DEFAULT_LABELS matches individual properties
    expect(USER_CONFIG.DEFAULT_LABELS).toEqual(allLabelsFromConfig);
  });
});
