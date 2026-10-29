import { randomUUID } from "node:crypto";

export async function fundedLearningParticipants(fixture, credit, skillName) {
  const teacher = await fixture.account();
  const learner = await fixture.account();
  for (const account of [teacher, learner]) {
    await fixture.db.creditWallet.create({
      data: {
        userId: account.user.id,
        availableCredit: credit,
        heldCredit: 0n,
        purchasedCredit: credit,
        bonusCredit: 0n,
        walletVersion: 0,
      },
    });
  }
  const skill = await fixture.db.skill.create({
    data: {
      name: skillName,
      nameKey: randomUUID(),
      slug: randomUUID(),
      status: "ACTIVE",
    },
  });
  return { teacher, learner, skill };
}
