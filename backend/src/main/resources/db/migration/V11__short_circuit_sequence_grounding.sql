ALTER TABLE lines ADD COLUMN r0_pu DOUBLE PRECISION;
ALTER TABLE lines ADD COLUMN x0_pu DOUBLE PRECISION;
ALTER TABLE lines ADD COLUMN b0_pu DOUBLE PRECISION;

ALTER TABLE transformers ADD COLUMN r0_pu DOUBLE PRECISION;
ALTER TABLE transformers ADD COLUMN x0_pu DOUBLE PRECISION;
ALTER TABLE transformers ADD COLUMN vector_group VARCHAR(32);
ALTER TABLE transformers ADD COLUMN hv_neutral_grounding VARCHAR(16);
ALTER TABLE transformers ADD COLUMN lv_neutral_grounding VARCHAR(16);
ALTER TABLE transformers ADD COLUMN hv_neutral_resistance_pu DOUBLE PRECISION;
ALTER TABLE transformers ADD COLUMN hv_neutral_reactance_pu DOUBLE PRECISION;
ALTER TABLE transformers ADD COLUMN lv_neutral_resistance_pu DOUBLE PRECISION;
ALTER TABLE transformers ADD COLUMN lv_neutral_reactance_pu DOUBLE PRECISION;

ALTER TABLE generators ADD COLUMN x2_pu DOUBLE PRECISION;
ALTER TABLE generators ADD COLUMN x0_pu DOUBLE PRECISION;
ALTER TABLE generators ADD COLUMN neutral_grounded BOOLEAN;
ALTER TABLE generators ADD COLUMN neutral_resistance_pu DOUBLE PRECISION;
ALTER TABLE generators ADD COLUMN neutral_reactance_pu DOUBLE PRECISION;
