/** SQL snippets reused across routes. */

const USERS_WITH_PREFS = `
  SELECT u.id, u.username, u.display_name, u.email, u.is_active, u.created_at, u.preferences, u.metadata,
         up.color_primary_r, up.color_primary_g, up.color_primary_b, up.color_primary_a,
         up.color_secondary_r, up.color_secondary_g, up.color_secondary_b, up.color_secondary_a,
         up.color_tertiary_r, up.color_tertiary_g, up.color_tertiary_b, up.color_tertiary_a,
         up.theme
    FROM users u
    LEFT JOIN user_preferences up ON u.id = up.user_id
   WHERE u.is_active = true
   ORDER BY u.display_name, u.username`;

const SPLIT_ALLOCATIONS_BY_TYPE = `
  SELECT tsc.transaction_id,
         tsa.id   AS allocation_id,
         tsa.split_id, tsa.user_id, tsa.amount, tsa.percentage,
         tsa.is_paid, tsa.paid_date, tsa.notes, tsa.created_at,
         u.username, u.display_name,
         tsc.id   AS config_id,
         st.code  AS split_type_code,
         st.label AS split_type_label
    FROM transaction_split_allocations tsa
    JOIN transaction_split_configs tsc ON tsa.split_id = tsc.id
    JOIN split_types st ON tsc.split_type_id = st.id
    JOIN users u ON tsa.user_id = u.id
   WHERE tsc.transaction_type_id = $1
   ORDER BY tsc.transaction_id, u.display_name, u.username`;

module.exports = { USERS_WITH_PREFS, SPLIT_ALLOCATIONS_BY_TYPE };
