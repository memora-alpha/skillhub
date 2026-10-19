final _email = RegExp(
  r"^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$",
);
final _letter = RegExp(r'\p{L}', unicode: true);
final _nameChars = RegExp(r"^[\p{L}\p{M} '\u2019-]+$", unicode: true);
final _upper = RegExp('[A-Z]');
final _lower = RegExp('[a-z]');
final _digit = RegExp('[0-9]');
final _special = RegExp(r'[^A-Za-z0-9\s]');
final _otp = RegExp(r'^\d{6}$');

String? validateEmail(String value) {
  final email = value.trim();
  if (email.isEmpty) return 'Vui lòng nhập email.';
  if (email.length < 5) return 'Email chưa đúng định dạng.';
  if (email.length > 254) return 'Email chỉ được tối đa 254 ký tự.';
  if (!_email.hasMatch(email)) return 'Email chưa đúng định dạng.';
  return null;
}

String? validateLoginPassword(String value) =>
    value.isEmpty ? 'Vui lòng nhập mật khẩu.' : null;

String? validatePassword(String value) {
  if (value.isEmpty) return 'Vui lòng nhập mật khẩu.';
  if (value.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (value.length > 64) return 'Mật khẩu chỉ được tối đa 64 ký tự.';
  if (!_upper.hasMatch(value)) return 'Thêm ít nhất một chữ hoa (A–Z).';
  if (!_lower.hasMatch(value)) return 'Thêm ít nhất một chữ thường (a–z).';
  if (!_digit.hasMatch(value)) return 'Thêm ít nhất một chữ số (0–9).';
  if (!_special.hasMatch(value)) return 'Thêm ký tự đặc biệt, ví dụ: @, #, !.';
  return null;
}

String? validateConfirmPassword(String value, String password) {
  if (value.isEmpty) return 'Vui lòng nhập lại mật khẩu.';
  if (value != password) return 'Mật khẩu nhập lại chưa khớp.';
  return null;
}

String? validateOtp(String value) {
  if (value.isEmpty) return 'Vui lòng nhập mã xác minh.';
  if (!_otp.hasMatch(value)) return 'Mã xác minh phải có 6 chữ số.';
  return null;
}

String? validateFullName(String value) {
  final name = value.trim();
  if (name.isEmpty) return 'Vui lòng nhập tên của bạn.';
  if (name.length < 2) return 'Tên cần ít nhất 2 ký tự.';
  if (name.length > 100) return 'Tên chỉ được tối đa 100 ký tự.';
  if (!_letter.hasMatch(name)) return 'Tên cần có ít nhất một chữ cái.';
  if (!_nameChars.hasMatch(name)) {
    return 'Tên chỉ gồm chữ, khoảng trắng, dấu nháy hoặc gạch nối.';
  }
  return null;
}

List<({String label, bool met})> passwordRequirements(String password) => [
  (label: '8–64 ký tự', met: password.length >= 8 && password.length <= 64),
  (label: 'Chữ hoa (A–Z)', met: _upper.hasMatch(password)),
  (label: 'Chữ thường (a–z)', met: _lower.hasMatch(password)),
  (label: 'Chữ số (0–9)', met: _digit.hasMatch(password)),
  (label: 'Ký tự đặc biệt', met: _special.hasMatch(password)),
];
