import 'package:flutter_test/flutter_test.dart';
import 'package:skillhub_mobile/core/config/env.dart';
import 'package:skillhub_mobile/core/http/app_error.dart';
import 'package:skillhub_mobile/core/http/http_client.dart';
import 'package:skillhub_mobile/features/auth/utils/auth_validation.dart';
import 'package:skillhub_mobile/features/profile/edit_profile_screen.dart';

void main() {
  group('normalizeApiUrl', () {
    test('accepts origin, /api and /api/v1', () {
      expect(
        normalizeApiUrl('http://10.0.2.2:3001'),
        'http://10.0.2.2:3001/api/v1',
      );
      expect(
        normalizeApiUrl('https://api.example.com/api/'),
        'https://api.example.com/api/v1',
      );
      expect(
        normalizeApiUrl(' http://localhost:3001/api/v1 '),
        'http://localhost:3001/api/v1',
      );
    });

    test('rejects other schemes, credentials, queries and paths', () {
      for (final value in [
        '',
        'ftp://host/api/v1',
        'http://user:pass@host/api/v1',
        'http://host/api/v1?x=1',
        'http://host/api/v1#frag',
        'http://host/v2',
      ]) {
        expect(
          () => normalizeApiUrl(value),
          throwsA(isA<AppError>()),
          reason: value,
        );
      }
    });
  });

  group('readPayload', () {
    test('unwraps the success envelope', () {
      expect(
        readPayload(200, {'success': true, 'message': 'OK', 'data': 42}),
        42,
      );
      expect(readPayload(204, null), isNull);
    });

    test('keeps only uppercase error codes', () {
      expect(
        () => readPayload(401, {'success': false, 'message': 'INVALID_CREDENTIALS'}),
        throwsA(
          isA<AppError>()
              .having((e) => e.status, 'status', 401)
              .having((e) => e.code, 'code', 'INVALID_CREDENTIALS'),
        ),
      );
      expect(
        () => readPayload(500, {'message': 'stack trace here'}),
        throwsA(isA<AppError>().having((e) => e.code, 'code', '')),
      );
    });

    test('rejects malformed success bodies', () {
      expect(
        () => readPayload(200, {'success': true}),
        throwsA(
          isA<AppError>().having((e) => e.kind, 'kind', AppErrorKind.protocol),
        ),
      );
    });
  });

  group('auth validation', () {
    test('email', () {
      expect(validateEmail('user@example.com'), isNull);
      expect(validateEmail(''), 'Vui lòng nhập email.');
      expect(validateEmail('a..b@example.com'), 'Email chưa đúng định dạng.');
    });

    test('password rules', () {
      expect(validatePassword('Abcdef1!'), isNull);
      expect(validatePassword('abcdef1!'), 'Thêm ít nhất một chữ hoa (A–Z).');
      expect(validatePassword('Abcdefg!'), 'Thêm ít nhất một chữ số (0–9).');
    });

    test('otp', () {
      expect(validateOtp('123456'), isNull);
      expect(validateOtp('12345'), 'Mã xác minh phải có 6 chữ số.');
    });
  });

  group('profile validation', () {
    test('name accepts Vietnamese letters, apostrophes and hyphens', () {
      expect(validateProfileName('Nguyễn Thị Hồng-Nhung'), isNull);
      expect(validateProfileName("O\u2019Brien"), isNull);
      expect(
        validateProfileName('A'),
        'Tên hiển thị cần từ 2 đến 100 ký tự.',
      );
      expect(
        validateProfileName('Minh 123'),
        'Tên chỉ gồm chữ, khoảng trắng, dấu nháy hoặc gạch nối.',
      );
    });

    test('text length counts surrogate pairs and variation selectors once', () {
      expect(profileTextLength('abc'), 3);
      expect(profileTextLength('😀'), 1);
      expect(profileTextLength('❤️'), 1);
    });
  });
}
