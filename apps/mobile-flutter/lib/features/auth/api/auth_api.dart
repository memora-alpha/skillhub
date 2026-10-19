import '../../../core/http/app_error.dart';
import '../../../core/http/http_client.dart';

class TokenPair {
  const TokenPair({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.refreshExpiresAt,
  });

  final String accessToken;
  final String refreshToken;
  final num expiresIn;
  final String refreshExpiresAt;

  static TokenPair parse(Object? value) {
    if (value is! Map<String, dynamic>) throw const AppError.protocol();
    final access = value['accessToken'];
    final refresh = value['refreshToken'];
    final expiresIn = value['expiresIn'];
    final refreshExpiresAt = value['refreshExpiresAt'];
    if (access is! String ||
        access.isEmpty ||
        refresh is! String ||
        refresh.isEmpty ||
        value['tokenType'] != 'Bearer' ||
        expiresIn is! num ||
        !expiresIn.isFinite ||
        expiresIn <= 0 ||
        refreshExpiresAt is! String ||
        DateTime.tryParse(refreshExpiresAt) == null) {
      throw const AppError.protocol();
    }
    return TokenPair(
      accessToken: access,
      refreshToken: refresh,
      expiresIn: expiresIn,
      refreshExpiresAt: refreshExpiresAt,
    );
  }
}

class PasswordResetProof {
  const PasswordResetProof({required this.resetToken, required this.expiresAt});

  final String resetToken;
  final String expiresAt;

  static final _token = RegExp(r'^[A-Za-z0-9_-]{43}$');

  static PasswordResetProof parse(Object? value) {
    if (value is! Map<String, dynamic>) throw const AppError.protocol();
    final token = value['resetToken'];
    final expiresAt = value['expiresAt'];
    if (token is! String ||
        !_token.hasMatch(token) ||
        expiresAt is! String ||
        DateTime.tryParse(expiresAt) == null) {
      throw const AppError.protocol();
    }
    return PasswordResetProof(resetToken: token, expiresAt: expiresAt);
  }

  bool get expired =>
      !(DateTime.tryParse(expiresAt)?.isAfter(DateTime.now()) ?? false);
}

class LoginInput {
  const LoginInput({
    required this.email,
    required this.password,
    required this.rememberMe,
  });

  final String email;
  final String password;
  final bool rememberMe;
}

class RegisterInput {
  const RegisterInput({
    required this.fullName,
    required this.email,
    required this.password,
    required this.confirmPassword,
  });

  final String fullName;
  final String email;
  final String password;
  final String confirmPassword;
}

class ResetInput {
  const ResetInput({
    required this.email,
    required this.resetToken,
    required this.newPassword,
    required this.confirmNewPassword,
  });

  final String email;
  final String resetToken;
  final String newPassword;
  final String confirmNewPassword;
}

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
