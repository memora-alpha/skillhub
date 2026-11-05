import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:skillhub_mobile/core/config/env.dart';
import 'package:skillhub_mobile/core/http/app_error.dart';
import 'package:skillhub_mobile/core/http/http_client.dart';
import 'package:skillhub_mobile/features/skills/schema/skill_schema.dart';
import 'package:skillhub_mobile/features/auth/utils/auth_validation.dart';
import 'package:skillhub_mobile/features/learning_requests/schema/learning_request_schema.dart';
import 'package:skillhub_mobile/features/profile/edit_profile_screen.dart';
import 'package:skillhub_mobile/features/learning_paths/negotiation_message.dart';
import 'package:skillhub_mobile/features/learning_paths/session_outline_editor.dart';
import 'package:skillhub_mobile/features/materials/material_decision_poll.dart';
import 'package:skillhub_mobile/features/messages/messages_data.dart';
import 'package:skillhub_mobile/features/skills/skill_decision_poll.dart';
import 'package:skillhub_mobile/features/wallet/payment_auto_read.dart';

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

  group('withQuery', () {
    test('omits nulls and encodes scalars', () {
      expect(withQuery('/x', {'a': 1, 'b': null}), '/x?a=1');
      expect(withQuery('/x', {'verifiedOnly': true}), '/x?verifiedOnly=true');
    });

    test('repeats list keys for tagIds', () {
      expect(
        withQuery('/learning-requests', {
          'keyword': 'react',
          'tagIds': ['aa', 'bb'],
        }),
        '/learning-requests?keyword=react&tagIds=aa&tagIds=bb',
      );
    });
  });

  group('RequestQuery', () {
    test('omits empty filters', () {
      expect(const RequestQuery().asQuery(), isEmpty);
      expect(
        const RequestQuery(keyword: 'react', tagIds: ['t1']).asQuery(),
        {'keyword': 'react', 'tagIds': ['t1']},
      );
    });
  });

  group('LearningRequestCard', () {
    test('reads owner id name and avatarUrl from feed payload', () {
      final card = LearningRequestCard.parse({
        'id': '11111111-1111-1111-1111-111111111111',
        'title': 'Python',
        'skill': {
          'id': '22222222-2222-2222-2222-222222222222',
          'name': 'Python',
        },
        'learningGoal': 'Goal',
        'status': 'OPEN',
        'verifiedTeacherOnly': false,
        'owner': {
          'id': '33333333-3333-3333-3333-333333333333',
          'displayName': 'Minh Mai',
          'avatarUrl': 'https://cdn.example/a.png',
        },
        'tags': [],
      });
      expect(card.ownerId, '33333333-3333-3333-3333-333333333333');
      expect(card.ownerName, 'Minh Mai');
      expect(card.ownerAvatarUrl, 'https://cdn.example/a.png');
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

  group('payment auto-read', () {
    Future<void> flush() => Future<void>.delayed(Duration.zero);

    test('stops on backend final or denial and never reads an unknown id', () async {
      for (final terminal in [
        'PAID',
        'FAILED',
        'EXPIRED',
        'REFUNDED',
        'CANCELLED',
        'denied',
      ]) {
        var status = 'CREATED';
        var reads = 0;
        void Function()? scheduled;
        final stop = startPaymentReadLoop(
          current: () => true,
          snapshot: () => PaymentReadSnapshot(
            id: 'known-id',
            status: status,
            denied: status == 'denied',
          ),
          read: () async {
            reads++;
            status = terminal;
          },
          schedule: (work, delay) {
            scheduled = work;
            return () => scheduled = null;
          },
        );
        expect(scheduled, isNotNull);
        scheduled!();
        await flush();
        expect(reads, 1);
        expect(scheduled, isNull);
        stop();
      }
      var reads = 0;
      startPaymentReadLoop(
        current: () => true,
        snapshot: () => const PaymentReadSnapshot(),
        read: () async => reads++,
        schedule: (work, delay) {
          fail('unknown ID must not schedule');
          return () {};
        },
      );
      expect(reads, 0);
    });

    test('pending checkout is observed within two seconds plus the API', () async {
      for (final initial in ['CREATED', 'PENDING']) {
        var status = initial;
        var elapsed = 0;
        var checks = 0;
        void Function()? tick;
        startPaymentReadLoop(
          current: () => true,
          snapshot: () => PaymentReadSnapshot(id: 'id', status: status),
          read: () async {
            checks++;
            elapsed += 750;
            status = 'PAID';
          },
          schedule: (work, delay) {
            tick = () {
              elapsed += delay.inMilliseconds;
              work();
            };
            return () => tick = null;
          },
        );
        tick!();
        await flush();
        expect(status, 'PAID');
        expect(checks, 1);
        expect(elapsed, lessThanOrEqualTo(2750), reason: initial);
        expect(tick, isNull);
      }
    });

    test('pending reads stay at 2s for ten minutes of observation', () async {
      final delays = <int>[];
      void Function()? tick;
      var reads = 0;
      var stopped = 0;
      startPaymentReadLoop(
        current: () => true,
        snapshot: () => const PaymentReadSnapshot(id: 'id', status: 'PENDING'),
        read: () async => reads++,
        onStop: () => stopped++,
        schedule: (work, delay) {
          delays.add(delay.inMilliseconds);
          tick = work;
          return () => tick = null;
        },
      );
      while (tick != null) {
        tick!();
        await flush();
        expect(reads, lessThanOrEqualTo(300));
      }
      expect(reads, 300);
      expect(delays, everyElement(2000));
      expect(delays.fold<int>(0, (sum, delay) => sum + delay), 600000);
      expect(stopped, 1);
    });

    test('a recovered read returns to quick checks and stops on PAID', () async {
      final delays = <int>[];
      var status = 'PENDING';
      var stale = false;
      void Function()? tick;
      var reads = 0;
      startPaymentReadLoop(
        current: () => true,
        snapshot: () =>
            PaymentReadSnapshot(id: 'id', status: status, stale: stale),
        read: () async {
          reads++;
          stale = reads == 1;
          if (stale) throw Exception('offline');
          if (reads == 3) status = 'PAID';
        },
        schedule: (work, delay) {
          delays.add(delay.inMilliseconds);
          tick = work;
          return () => tick = null;
        },
      );
      for (var attempt = 0; attempt < 3; attempt++) {
        tick!();
        await flush();
      }
      expect(delays, [2000, 10000, 2000]);
      expect(status, 'PAID');
      expect(tick, isNull);
    });

    test('review and unknown keep the slower cadence and 120-read limit', () async {
      for (final status in ['REVIEW', 'UNKNOWN']) {
        void Function()? tick;
        var reads = 0;
        startPaymentReadLoop(
          current: () => true,
          snapshot: () => PaymentReadSnapshot(id: 'id', status: status),
          read: () async => reads++,
          schedule: (work, delay) {
            expect(delay, const Duration(seconds: 30));
            tick = work;
            return () => tick = null;
          },
        );
        while (tick != null) {
          tick!();
          await flush();
          expect(reads, lessThanOrEqualTo(120));
        }
        expect(reads, 120, reason: status);
      }
    });

    test('blur cancels the timer and an in-flight read cannot reschedule', () async {
      var current = true;
      void Function()? scheduled;
      var reads = 0;
      final gate = Completer<void>();
      final stop = startPaymentReadLoop(
        current: () => current,
        snapshot: () => const PaymentReadSnapshot(id: 'id', status: 'PENDING'),
        read: () {
          reads++;
          return gate.future;
        },
        schedule: (work, delay) {
          scheduled = work;
          return () => scheduled = null;
        },
      );
      scheduled!();
      expect(reads, 1);
      current = false;
      stop();
      gate.complete();
      await flush();
      expect(scheduled, isNull);
    });

    test('read errors back off and a finite budget never fabricates expiry', () async {
      final delays = <int>[];
      void Function()? tick;
      var reads = 0;
      var ended = 0;
      startPaymentReadLoop(
        current: () => true,
        snapshot: () =>
            const PaymentReadSnapshot(id: 'id', status: 'PENDING', stale: true),
        read: () async {
          reads++;
          throw Exception('network');
        },
        maxReads: 2,
        onStop: () => ended++,
        schedule: (work, delay) {
          tick = work;
          delays.add(delay.inMilliseconds);
          return () => tick = null;
        },
      );
      tick!();
      await flush();
      tick!();
      await flush();
      expect(reads, 2);
      expect(ended, 1);
      expect(tick, isNull);
      expect(delays[1], greaterThan(delays[0]));
    });

    test('a timer captured for one payment cannot read a replacement id', () async {
      var id = 'A';
      var reads = 0;
      void Function()? tick;
      startPaymentReadLoop(
        current: () => true,
        snapshot: () => PaymentReadSnapshot(id: id, status: 'PENDING'),
        read: () async => reads++,
        schedule: (work, delay) {
          tick = work;
          return () => tick = null;
        },
      );
      id = 'B';
      tick!();
      await flush();
      expect(reads, 0);
      expect(tick, isNull);
    });
  });

  group('hasPendingSkillDecision', () {
    test('polls while a sharing skill is waiting on staff', () {
      expect(hasPendingSkillDecision(const ['UNVERIFIED', 'PENDING']), isTrue);
      expect(hasPendingSkillDecision(const ['VERIFIED', 'REJECTED']), isFalse);
    });
  });

  group('hasPendingMaterialReview', () {
    test('polls while a shared material is waiting on staff', () {
      expect(
        hasPendingMaterialReview(const ['DRAFT', 'PENDING_REVIEW']),
        isTrue,
      );
      expect(hasPendingMaterialReview(const ['PUBLISHED', 'REJECTED']), isFalse);
    });
  });

  group('sessionContent', () {
    test('keeps the first line as title and the rest as description', () {
      expect(
        sessionContentParts('React cơ bản\nJSX và component'),
        (title: 'React cơ bản', description: 'JSX và component'),
      );
      expect(
        sessionContentText('React cơ bản', 'JSX và component'),
        'React cơ bản\nJSX và component',
      );
      expect(sessionContentText('  Chỉ tiêu đề  ', ''), 'Chỉ tiêu đề');
    });
  });

  group('conversationByKey', () {
    Conversation conversation(String id, String proposal, String last) =>
        Conversation(
          id: id,
          proposal: proposal,
          name: 'Minh Mai',
          userId: 'user-1',
          skill: '',
          request: '',
          last: last,
          messages: 1,
          unread: 0,
          time: '08:06',
          createdAt: null,
        );

    test('opens the conversation for that proposal, not another with the same partner', () {
      final first = conversation('conv-1', 'proposal-1', '123');
      final second = conversation('conv-2', 'proposal-2', 'helluu');
      final items = [first, second];
      expect(conversationByKey(items, 'conv-2')?.last, 'helluu');
      expect(conversationByKey(items, 'proposal-2')?.id, 'conv-2');
      expect(conversationByKey(items, 'conv-1')?.proposal, 'proposal-1');
      expect(conversationByKey(items, 'missing'), isNull);
    });

    test('prefers conversation id when it differs from another proposal id', () {
      final first = conversation('shared-id', 'proposal-a', 'first');
      final second = conversation('conv-b', 'shared-id', 'second');
      expect(conversationByKey([first, second], 'shared-id')?.last, 'first');
    });

    test('labels each proposal conversation with a distinct reference', () {
      expect(conversationReference('aaaaaaaa-bbbb-cccc-dddd-1234abcd'), '#1234ABCD');
    });
  });

  group('asInt', () {
    test('accepts whole JSON numbers', () {
      expect(asInt(1), 1);
      expect(asInt(1.0), 1);
      expect(() => asInt(1.5), throwsA(isA<AppError>()));
    });
  });

  group('path negotiation message', () {
    test('round-trips format and preview', () {
      final text = formatNegotiationMessage(
        twoWay: false,
        role: 'Tôi dạy',
        skill: 'Python',
        goal: 'Học ML cơ bản',
        credit: '20',
        lessons: const ['Pandas', 'Pytorch'],
      );
      final parsed = readNegotiationMessage(text);
      expect(parsed, isNotNull);
      expect(parsed!.skill, 'Python');
      expect(parsed.goal, 'Học ML cơ bản');
      expect(parsed.credit, '20');
      expect(parsed.twoWay, isFalse);
      expect(parsed.teach, isTrue);
      expect(parsed.sessions, ['Pandas', 'Pytorch']);
      expect(conversationMessagePreview(text), 'Gợi ý lộ trình · Python');
    });
  });

  group('SharingSkillRecord.parse', () {
    test('accepts catalog-shaped nested skills and level from skillLevel', () {
      final record = SharingSkillRecord.parse({
        'id': '11111111-1111-1111-1111-111111111111',
        'skill': {
          'id': '22222222-2222-2222-2222-222222222222',
          'name': 'JavaScript',
          'status': 'ACTIVE',
          'description': null,
        },
        'skillLevel': {'code': 'BEGINNER'},
        'description': 'Can mentor JavaScript fundamentals for new learners.',
        'experienceYears': 2.5,
        'verificationStatus': 'UNVERIFIED',
        'isVisible': true,
        'archivedAt': null,
        'version': 1,
      });
      expect(record.skill.name, 'JavaScript');
      expect(record.skill.nameKey, 'JavaScript');
      expect(record.level, 'BEGINNER');
      expect(record.experienceYears, '2.5');
    });
  });
}
