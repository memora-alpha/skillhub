-- Spec 021 D8: one versioned fee policy series per plan tier. Tier policies are drafted and
-- approved through the fee policy admin like the base series; none is seeded.

-- AlterEnum
ALTER TYPE "FeePolicyCode" ADD VALUE 'ONE_WAY_CREATOR';
ALTER TYPE "FeePolicyCode" ADD VALUE 'ONE_WAY_PRO';
ALTER TYPE "FeePolicyCode" ADD VALUE 'MATERIAL_PAID_CREATOR';
ALTER TYPE "FeePolicyCode" ADD VALUE 'MATERIAL_PAID_PRO';
