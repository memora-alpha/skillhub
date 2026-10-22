import '../../../core/http/http_client.dart';
import '../schema/auth_schema.dart';

class AuthApi {
  AuthApi(this._client);

  final HttpClient _client;

  Future<Object?> _post(String path, Object body) =>
      _client.request('/auth/$path', method: 'POST', body: body);

  Future<TokenPair> login(LoginInput input) async => TokenPair.parse(
    await _post('login', {
      'email': input.email,
      'password': input.password,
      'rememberMe': input.rememberMe,
    }),
  );

  Future<TokenPair> refresh(String refreshToken) async =>
      TokenPair.parse(await _post('refresh', {'refreshToken': refreshToken}));

  Future<void> register(RegisterInput input) => _post('register', {
    'fullName': input.fullName,
    'email': input.email,
    'password': input.password,
    'confirmPassword': input.confirmPassword,
    'agreeTerms': true,
    'locale': 'vi',
  });

  Future<void> verify(String email, String otpCode) =>
      _post('verification/verify', {'email': email, 'otpCode': otpCode});

  Future<void> resend(String email) =>
      _post('verification/resend', {'email': email});

  Future<void> forgot(String email) =>
      _post('password/forgot', {'email': email});

  Future<PasswordResetProof> verifyRecovery(
    String email,
    String otpCode,
  ) async => PasswordResetProof.parse(
    await _post('password/verify-otp', {'email': email, 'otpCode': otpCode}),
  );

  Future<void> reset(ResetInput input) => _post('password/reset', {
    'email': input.email,
    'resetToken': input.resetToken,
    'newPassword': input.newPassword,
    'confirmNewPassword': input.confirmNewPassword,
  });

  Future<void> logout(String refreshToken) =>
      _post('logout', {'refreshToken': refreshToken});

  Future<void> logoutAll() => _client.request(
    '/auth/logout-all',
    method: 'POST',
    body: const <String, Object>{},
    authenticated: true,
  );
}
