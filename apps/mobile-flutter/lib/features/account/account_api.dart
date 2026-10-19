import 'package:dio/dio.dart';

import '../../core/http/app_error.dart';
import '../../core/http/http_client.dart';

const accountStatuses = {
  'PENDING_VERIFICATION',
  'ACTIVE',
  'LOCKED',
  'SUSPENDED',
  'DEACTIVATED',
};

class OwnProfile {
  const OwnProfile({
    required this.userId,
    required this.fullName,
    required this.headline,
    required this.bio,
    required this.timezone,
    required this.locale,
    required this.avatarUrl,
    required this.reputationScore,
    required this.verifiedSkillCount,
    required this.completedSessionCount,
  });

  final String userId;
  final String fullName;
  final String headline;
  final String bio;
  final String? timezone;
  final String locale;
  final String? avatarUrl;
  final num? reputationScore;
  final int verifiedSkillCount;
  final int completedSessionCount;

  OwnProfile withoutAvatar() => OwnProfile(
    userId: userId,
    fullName: fullName,
    headline: headline,
    bio: bio,
    timezone: timezone,
    locale: locale,
    avatarUrl: null,
    reputationScore: reputationScore,
    verifiedSkillCount: verifiedSkillCount,
    completedSessionCount: completedSessionCount,
  );

  static bool _count(Object? value) => value is int && value >= 0;

  static OwnProfile parse(Object? value) {
    if (value is! Map<String, dynamic>) throw const AppError.protocol();
    final timezone = value['timezone'];
    final avatarUrl = value['avatarUrl'];
    final score = value['reputationScore'];
    if (value['userId'] is! String ||
        value['fullName'] is! String ||
        value['headline'] is! String ||
        value['bio'] is! String ||
        !(timezone == null || timezone is String) ||
        !(avatarUrl == null || avatarUrl is String) ||
        !const {'vi', 'en'}.contains(value['locale']) ||
        !(score == null || (score is num && score.isFinite)) ||
        !_count(value['verifiedSkillCount']) ||
        !_count(value['completedSessionCount'])) {
      throw const AppError.protocol();
    }
    return OwnProfile(
      userId: value['userId'] as String,
      fullName: value['fullName'] as String,
      headline: value['headline'] as String,
      bio: value['bio'] as String,
      timezone: timezone as String?,
      locale: value['locale'] as String,
      avatarUrl: avatarUrl as String?,
      reputationScore: score as num?,
      verifiedSkillCount: value['verifiedSkillCount'] as int,
      completedSessionCount: value['completedSessionCount'] as int,
    );
  }
}

class OwnIdentity {
  const OwnIdentity({
    required this.userId,
    required this.email,
    required this.emailVerified,
    required this.accountStatus,
    required this.roles,
    required this.profile,
  });

  final String userId;
  final String email;
  final bool emailVerified;
  final String accountStatus;
  final List<String> roles;
  final OwnProfile profile;

  OwnIdentity withProfile(OwnProfile next) => OwnIdentity(
    userId: userId,
    email: email,
    emailVerified: emailVerified,
    accountStatus: accountStatus,
    roles: roles,
    profile: next,
  );

  static OwnIdentity parse(Object? value) {
    if (value is! Map<String, dynamic>) throw const AppError.protocol();
    final roles = value['roles'];
    if (value['userId'] is! String ||
        value['email'] is! String ||
        value['emailVerified'] is! bool ||
        !accountStatuses.contains(value['accountStatus']) ||
        roles is! List ||
        roles.length != 1 ||
        roles.first is! String) {
      throw const AppError.protocol();
    }
    final profile = OwnProfile.parse(value['profile']);
    if (profile.userId != value['userId']) throw const AppError.protocol();
    return OwnIdentity(
      userId: value['userId'] as String,
      email: value['email'] as String,
      emailVerified: value['emailVerified'] as bool,
      accountStatus: value['accountStatus'] as String,
      roles: [roles.first as String],
      profile: profile,
    );
  }
}

class ProfilePatch {
  const ProfilePatch({
    required this.fullName,
    required this.headline,
    required this.bio,
  });

  final String fullName;
  final String headline;
  final String bio;

  Map<String, Object> toJson() => {
    'fullName': fullName,
    'headline': headline,
    'bio': bio,
  };
}

enum AvatarStatus { quarantined, clean, rejected, deleted }

class AvatarUpload {
  const AvatarUpload({required this.assetId, required this.status});

  final String assetId;
  final AvatarStatus status;

  static final _uuid = RegExp(
    r'^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$',
    caseSensitive: false,
  );
  static const _statuses = {
    'QUARANTINED': AvatarStatus.quarantined,
    'CLEAN': AvatarStatus.clean,
    'REJECTED': AvatarStatus.rejected,
    'DELETED': AvatarStatus.deleted,
  };

  static AvatarUpload parse(Object? value) {
    if (value is! Map<String, dynamic>) throw const AppError.protocol();
    final assetId = value['assetId'];
    final status = _statuses[value['status']];
    if (assetId is! String || !_uuid.hasMatch(assetId) || status == null) {
      throw const AppError.protocol();
    }
    return AvatarUpload(assetId: assetId, status: status);
  }
}

class AccountApi {
  AccountApi(this._client);

  final HttpClient _client;

  Future<OwnIdentity> getMe() async =>
      OwnIdentity.parse(await _client.request('/me', authenticated: true));

  Future<OwnProfile> updateProfile(ProfilePatch patch) async =>
      OwnProfile.parse(
        await _client.request(
          '/me/profile',
          method: 'PATCH',
          body: patch.toJson(),
          authenticated: true,
        ),
      );

  Future<AvatarUpload> uploadAvatar(FormData body) async => AvatarUpload.parse(
    await _client.request(
      '/me/avatar',
      method: 'POST',
      body: body,
      authenticated: true,
    ),
  );

  Future<AvatarUpload> getAvatarUpload(String assetId) async {
    final upload = AvatarUpload.parse(
      await _client.request(
        '/me/avatar/uploads/${Uri.encodeComponent(assetId)}',
        authenticated: true,
      ),
    );
    if (upload.assetId != assetId) throw const AppError.protocol();
    return upload;
  }

  Future<void> removeAvatar() =>
      _client.request('/me/avatar', method: 'DELETE', authenticated: true);
}
