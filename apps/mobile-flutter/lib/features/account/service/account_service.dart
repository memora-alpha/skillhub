import 'package:dio/dio.dart';

import '../../../core/http/http_client.dart';
import '../api/account_api.dart';
import '../schema/account_schema.dart';

/// Account use cases the screens call. HTTP stays in [AccountApi].
class AccountService {
  AccountService(HttpClient client) : _api = AccountApi(client);

  final AccountApi _api;

  Future<OwnIdentity> getMe() => _api.getMe();

  Future<OwnProfile> updateProfile(ProfilePatch patch) =>
      _api.updateProfile(patch);

  Future<AvatarUpload> uploadAvatar(FormData body) => _api.uploadAvatar(body);

  Future<AvatarUpload> getAvatarUpload(String assetId) =>
      _api.getAvatarUpload(assetId);

  Future<void> removeAvatar() => _api.removeAvatar();

  Future<Map<String, dynamic>> publicProfile(String userId) =>
      _api.publicProfile(userId);
}
