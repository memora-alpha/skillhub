import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session/auth_session.dart';
import '../messages/messages_data.dart';

const _unset = Object();

const proposalStatusLabels = {
  'PENDING': 'Chờ phản hồi',
  'ACCEPTED': 'Đã chấp nhận',
  'REJECTED': 'Đã từ chối',
  'WITHDRAWN': 'Đã rút',
  'EXPIRED': 'Đã hết hạn',
};

const closedProposalStatuses = ['REJECTED', 'WITHDRAWN', 'EXPIRED'];

class DemoProposal {
  const DemoProposal({
    required this.id,
    required this.direction,
    required this.sourceType,
    required this.requestTitle,
    required this.partnerId,
    required this.partner,
    required this.skill,
    required this.message,
    required this.credit,
    required this.sessions,
    required this.schedule,
    required this.time,
    required this.status,
    this.requestId,
    this.localDecisionNote,
  });

  final String id;
  final String direction;
  final String sourceType;
  final String? requestId;
  final String requestTitle;
  final String partnerId;
  final String partner;
  final String skill;
  final String message;
  final String credit;
  final int sessions;
  final String schedule;
  final String time;
  final String status;

  /// UI-only note; no backend rejection DTO is defined yet.
  final String? localDecisionNote;

  bool get sent => direction == 'sent';
  bool get closed => closedProposalStatuses.contains(status);

  DemoProposal copyWith({
    String? message,
    String? credit,
    int? sessions,
    String? schedule,
    String? time,
    String? status,
    Object? localDecisionNote = _unset,
  }) => DemoProposal(
    id: id,
    direction: direction,
    sourceType: sourceType,
    requestId: requestId,
    requestTitle: requestTitle,
    partnerId: partnerId,
    partner: partner,
    skill: skill,
    message: message ?? this.message,
    credit: credit ?? this.credit,
    sessions: sessions ?? this.sessions,
    schedule: schedule ?? this.schedule,
    time: time ?? this.time,
    status: status ?? this.status,
    localDecisionNote: localDecisionNote == _unset
        ? this.localDecisionNote
        : localDecisionNote as String?,
  );
}

const demoTeachingSkills = [
  (id: 'react', name: 'React', verified: true),
  (id: 'javascript', name: 'JavaScript', verified: true),
  (id: 'typescript', name: 'TypeScript', verified: false),
];

final List<DemoProposal> initialProposals = [
  for (final item in const [
    (
      id: 'DX-2410',
      partnerId: 'demo-viet-anh',
      partner: 'Trần Việt Anh',
      credit: '50',
      time: '2 giờ trước',
      message:
          'Mình có thể hướng dẫn React theo dự án thực tế, từ component và hooks đến một ứng dụng hoàn chỉnh.',
    ),
    (
      id: 'DX-2411',
      partnerId: 'demo-minh-khang',
      partner: 'Nguyễn Minh Khang',
      credit: '45',
      time: '4 giờ trước',
      message:
          'Mình có kinh nghiệm React và TypeScript. Có thể giúp bạn xây dựng ứng dụng từ những kiến thức nền tảng.',
    ),
    (
      id: 'DX-2412',
      partnerId: 'demo-thu-ha',
      partner: 'Phạm Thu Hà',
      credit: '60',
      time: 'Hôm qua',
      message:
          'Mình có thể hướng dẫn React vào cuối tuần, cùng thực hành và xem lại từng bài tập.',
    ),
  ])
    DemoProposal(
      id: item.id,
      partnerId: item.partnerId,
      partner: item.partner,
      credit: item.credit,
      time: item.time,
      message: item.message,
      direction: 'received',
      sourceType: 'LEARNING_REQUEST',
      requestId: 'my-react',
      requestTitle: 'Muốn học React từ cơ bản đến nâng cao',
      skill: 'React',
      sessions: 6,
      schedule: 'Tối Thứ 5 và Thứ 7',
      status: 'PENDING',
    ),
  for (final item in conversations)
    DemoProposal(
      id: item.proposal,
      direction: 'received',
      sourceType: 'LEARNING_REQUEST',
      requestId: 'accepted-${item.proposal}',
      requestTitle: item.request,
      partnerId: item.userId,
      partner: item.name,
      skill: item.skill,
      message:
          'Đề xuất đã được chấp nhận trong dữ liệu mẫu. Hai người tiếp tục trao đổi trong Chat.',
      credit: '30',
      sessions: 4,
      schedule: 'Thương lượng trong Chat',
      time: item.time,
      status: 'ACCEPTED',
    ),
  const DemoProposal(
    id: 'demo-direct-invitation',
    direction: 'received',
    sourceType: 'DIRECT_SEARCH',
    requestTitle: 'Lời mời học React từ hồ sơ công khai',
    partnerId: 'demo-hong-anh',
    partner: 'Nguyễn Hồng Anh',
    skill: 'React',
    message:
        'Mình muốn cùng bạn trao đổi cách xây dựng giao diện React và thực hành một dự án nhỏ vào cuối tuần.',
    credit: '30',
    sessions: 4,
    schedule: 'Cuối tuần, trao đổi thêm sau khi kết nối',
    time: 'Dữ liệu mẫu',
    status: 'PENDING',
  ),
  const DemoProposal(
    id: 'demo-expired-proposal',
    direction: 'sent',
    sourceType: 'DIRECT_SEARCH',
    requestTitle: 'Lời mời trao đổi React',
    partnerId: 'demo-thu-ha',
    partner: 'Phạm Thu Hà',
    skill: 'React',
    message:
        'Mình có thể chia sẻ React qua các bài tập thực hành, cùng xem lại kết quả sau mỗi buổi.',
    credit: '40',
    sessions: 4,
    schedule: 'Chưa thống nhất',
    time: 'Dữ liệu mẫu',
    status: 'EXPIRED',
  ),
];

String? validateProposalMessage(String value) {
  final length = value.trim().runes.length;
  return length < 10 || length > 1000
      ? 'Nhập lời giới thiệu từ 10 đến 1.000 ký tự.'
      : null;
}

String? validateProposalCredit(String value) {
  final text = value.trim();
  return RegExp(r'^\d{1,10}(?:\.\d{1,2})?$').hasMatch(text) &&
          num.parse(text) > 0
      ? null
      : 'Nhập Credit lớn hơn 0, tối đa 10 chữ số nguyên và 2 chữ số thập phân.';
}

String? validateProposalSessions(String value) {
  final text = value.trim();
  final number = RegExp(r'^\d+$').hasMatch(text) ? int.tryParse(text) : null;
  return number != null && number >= 1
      ? null
      : 'Nhập số buổi nguyên lớn hơn hoặc bằng 1.';
}

String? validateRejectionNote(String value) {
  final text = value.trim();
  if (text.isEmpty) {
    return 'Nhập lý do từ chối để người gửi hiểu lựa chọn của bạn.';
  }
  return text.runes.length > 1000 ? 'Lý do không vượt quá 1.000 ký tự.' : null;
}

class ProposalsNotifier extends Notifier<List<DemoProposal>> {
  int _sequence = 0;

  @override
  List<DemoProposal> build() {
    ref.watch(sessionSnapshotProvider.select((s) => s.generation));
    return initialProposals;
  }

  DemoProposal? find(String? id) =>
      state.where((p) => p.id == id).firstOrNull;

  bool submit({
    required String sourceType,
    required String? requestId,
    required String requestTitle,
    required String partnerId,
    required String partner,
    required String skill,
    required String message,
    required String credit,
    required int sessions,
    required String schedule,
  }) {
    if (ref.read(accountSessionProvider) == null ||
        state.any(
          (item) =>
              item.sent &&
              item.status == 'PENDING' &&
              item.partnerId == partnerId &&
              item.requestId == requestId &&
              item.sourceType == sourceType,
        )) {
      return false;
    }
    state = [
      DemoProposal(
        id: 'local-proposal-${DateTime.now().millisecondsSinceEpoch}-${++_sequence}',
        direction: 'sent',
        sourceType: sourceType,
        requestId: requestId,
        requestTitle: requestTitle,
        partnerId: partnerId,
        partner: partner,
        skill: skill,
        message: message,
        credit: credit,
        sessions: sessions,
        schedule: schedule,
        time: 'Vừa xong',
        status: 'PENDING',
      ),
      ...state,
    ];
    return true;
  }

  bool update(
    String id, {
    required String message,
    required String credit,
    required String sessions,
    required String schedule,
  }) {
    final item = find(id);
    if (ref.read(accountSessionProvider) == null ||
        item == null ||
        !item.sent ||
        item.status != 'PENDING' ||
        validateProposalMessage(message) != null ||
        validateProposalCredit(credit) != null ||
        validateProposalSessions(sessions) != null) {
      return false;
    }
    state = [
      for (final p in state)
        p.id == id
            ? p.copyWith(
                message: message.trim(),
                credit: credit.trim(),
                sessions: int.parse(sessions.trim()),
                schedule: schedule.trim(),
                time: 'Vừa cập nhật',
              )
            : p,
    ];
    return true;
  }

  /// [status] is `ACCEPTED`, `REJECTED` or `WITHDRAWN`.
  bool decide(String id, String status, [String? localDecisionNote]) {
    final item = find(id);
    if (ref.read(accountSessionProvider) == null ||
        item == null ||
        item.status != 'PENDING' ||
        (status == 'WITHDRAWN' ? !item.sent : item.sent)) {
      return false;
    }
    if (status == 'ACCEPTED' &&
        item.requestId != null &&
        state.any(
          (other) =>
              other.requestId == item.requestId && other.status == 'ACCEPTED',
        )) {
      return false;
    }
    state = [
      for (final p in state)
        p.id == id
            ? p.copyWith(
                status: status,
                localDecisionNote: status == 'REJECTED'
                    ? localDecisionNote?.trim()
                    : null,
              )
            : p,
    ];
    if (status == 'ACCEPTED') {
      ref
          .read(messagesProvider.notifier)
          .openConversation(
            Conversation(
              proposal: item.id,
              name: item.partner,
              userId: item.partnerId,
              skill: item.skill,
              request: item.requestTitle,
              last:
                  'Đề xuất đã chấp nhận. Bắt đầu trao đổi về lộ trình và lịch học.',
              messages: 0,
              unread: 0,
              time: 'Vừa xong',
            ),
          );
    }
    return true;
  }
}

final proposalsProvider =
    NotifierProvider<ProposalsNotifier, List<DemoProposal>>(
      ProposalsNotifier.new,
    );
