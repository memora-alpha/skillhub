import 'package:dio/dio.dart';

import '../../../core/http/app_error.dart';
import '../../../core/http/http_client.dart';
import '../schema/account_schema.dart';

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
