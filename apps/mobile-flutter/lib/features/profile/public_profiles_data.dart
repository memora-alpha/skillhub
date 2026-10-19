import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session/auth_session.dart';
import '../remote/remote_load.dart';

typedef DemoSkill = ({String id, String name, String level, bool verified});
typedef DemoReview = ({String name, String text, int stars});

class DemoPublicProfile {
  const DemoPublicProfile({
    required this.id,
    required this.name,
    this.headline,
    this.bio,
    this.reputation,
    this.rating,
    this.stats,
    this.skills = const [],
    this.reviews,
  });

  final String id;
  final String name;
  final String? headline;
  final String? bio;
  final int? reputation;
  final String? rating;
  final List<({String value, String label})>? stats;
  final List<DemoSkill> skills;
  final List<DemoReview>? reviews;
}

DemoPublicProfile? parsePublicProfile(Map<String, dynamic> json) {
  final userId = json['userId'];
  if (userId is! String || userId.isEmpty) return null;
  final skillsRaw = json['sharingSkills'];
  final data = skillsRaw is Map && skillsRaw['data'] is List
      ? skillsRaw['data'] as List
      : const [];
  final skills = <DemoSkill>[];
  for (final item in data) {
    if (item is! Map) continue;
    final skill = item['skill'];
    final name = skill is Map ? skill['name']?.toString() ?? '' : '';
    skills.add((
      id: item['id']?.toString() ?? '',
      name: name,
      level: item['level']?.toString() ?? '',
      verified: item['verificationStatus'] == 'VERIFIED',
    ));
  }
  final score = json['reputationScore'];
  return DemoPublicProfile(
    id: userId,
    name: json['fullName']?.toString() ?? '',
    headline: json['headline']?.toString(),
    bio: json['bio']?.toString(),
    reputation: score is num ? score.round() : int.tryParse('$score'),
    stats: [
      (value: '${json['completedSessionCount'] ?? 0}', label: 'Buổi học'),
      (value: '${json['verifiedSkillCount'] ?? 0}', label: 'Kỹ năng xác minh'),
    ],
    skills: skills,
  );
}

final publicProfileProvider = FutureProvider.family<DemoPublicProfile?, String>(
  (ref, userId) async {
    if (userId.isEmpty) return null;
    final phase = ref.watch(sessionSnapshotProvider).phase;
    if (phase != SessionPhase.ready) return null;
    try {
      final runtime = ref.read(authRuntimeProvider);
      final json = await runtime.account.publicProfile(userId);
      final parsed = parsePublicProfile(json);
      if (parsed == null) return null;
      try {
        final records = await drainPages(
          (cursor) => runtime.services.skills.profileSkills(
            userId,
            cursor: cursor,
            limit: 20,
          ),
        );
        return DemoPublicProfile(
          id: parsed.id,
          name: parsed.name,
          headline: parsed.headline,
          bio: parsed.bio,
          reputation: parsed.reputation,
          rating: parsed.rating,
          stats: parsed.stats,
          reviews: parsed.reviews,
          skills: [
            for (final record in records)
              (
                id: record.id,
                name: record.skill.name,
                level: record.level,
                verified: record.verificationStatus == 'VERIFIED',
              ),
          ],
        );
      } catch (_) {
        return parsed;
      }
    } catch (_) {
      return null;
    }
  },
);
