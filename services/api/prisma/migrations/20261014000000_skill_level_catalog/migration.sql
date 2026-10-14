CREATE TABLE skill_levels (
  level_id uuid NOT NULL PRIMARY KEY,
  skill_id uuid NOT NULL REFERENCES skills(skill_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  code varchar(40) NOT NULL,
  name varchar(100) NOT NULL,
  name_key text NOT NULL,
  description varchar(500),
  sort_order integer NOT NULL DEFAULT 0,
  status "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT skill_levels_values CHECK (
    code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'
    AND char_length(btrim(name)) BETWEEN 2 AND 100
    AND name_key = lower(btrim(regexp_replace(normalize(name,NFC),'\s+',' ','g')))
    AND sort_order BETWEEN 0 AND 100000 AND version > 0
    AND status IN ('ACTIVE','INACTIVE'))
);
CREATE UNIQUE INDEX skill_levels_skill_id_level_id_key ON skill_levels(skill_id, level_id);
CREATE UNIQUE INDEX skill_levels_skill_id_code_key ON skill_levels(skill_id, code);
CREATE UNIQUE INDEX skill_levels_skill_id_name_key_key ON skill_levels(skill_id, name_key);
CREATE INDEX skill_levels_skill_id_status_sort_order_level_id_idx ON skill_levels(skill_id,status,sort_order,level_id);

-- Preserve every old selection, including archived skills and Sharing Skills.
INSERT INTO skill_levels(level_id,skill_id,code,name,name_key,sort_order)
SELECT gen_random_uuid(),s.skill_id,l.code,l.name,lower(l.name),l.sort_order
FROM skills s CROSS JOIN (VALUES
 ('BEGINNER','Beginner',0), ('INTERMEDIATE','Intermediate',1),
 ('ADVANCED','Advanced',2), ('EXPERT','Expert',3)
) AS l(code,name,sort_order);
ALTER TABLE sharing_skills ADD COLUMN level_id uuid;
UPDATE sharing_skills s SET level_id=l.level_id
FROM skill_levels l WHERE l.skill_id=s.skill_id AND l.code=s.level::text;
-- Expand migration: old clients/writers may still supply the enum. New API writes
-- always resolve level_id. The retained enum is null for custom catalog codes.
ALTER TABLE sharing_skills ALTER COLUMN level DROP NOT NULL;
ALTER TABLE sharing_skills ADD CONSTRAINT sharing_skills_level_selection
  CHECK (level_id IS NOT NULL OR level IS NOT NULL);
ALTER TABLE sharing_skills ADD CONSTRAINT sharing_skills_skill_level_fkey
  FOREIGN KEY(skill_id,level_id) REFERENCES skill_levels(skill_id,level_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX sharing_skills_skill_id_level_id_idx ON sharing_skills(skill_id,level_id);
