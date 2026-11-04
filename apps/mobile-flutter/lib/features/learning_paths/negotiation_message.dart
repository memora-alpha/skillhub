/// Parses legacy chat negotiation text (`GỢI Ý LỘ TRÌNH · CHƯA XÁC NHẬN`).
class PathNegotiationSuggestion {
  const PathNegotiationSuggestion({
    required this.raw,
    required this.twoWay,
    required this.teach,
    required this.skill,
    required this.goal,
    required this.credit,
    required this.sessions,
    required this.exchangeLabel,
    required this.directionLabel,
  });

  final String raw;
  final bool twoWay;
  final bool teach;
  final String skill;
  final String goal;
  final String credit;
  final List<String> sessions;
  final String exchangeLabel;
  final String directionLabel;

  String get preview =>
      skill.isEmpty ? 'Gợi ý lộ trình' : 'Gợi ý lộ trình · $skill';
}

PathNegotiationSuggestion? readNegotiationMessage(String text) {
  final trimmed = text.trim();
  if (trimmed.length > 2000) return null;
  const headings = ['GỢI Ý LỘ TRÌNH', 'GỢI Ý LEARNING PATH'];
  if (!headings.any(
    (heading) => trimmed.startsWith('$heading · CHƯA XÁC NHẬN\n'),
  )) {
    return null;
  }
  final lines = trimmed.split('\n');
  if (lines.isEmpty || !(lines.last).endsWith('Chưa giữ Credit.')) {
    return null;
  }

  String? field(String prefix) {
    for (final line in lines) {
      if (line.startsWith(prefix)) return line.substring(prefix.length).trim();
    }
    return null;
  }

  final skill = field('Kỹ năng: ');
  final goal = field('Mục tiêu: ');
  if (skill == null || skill.isEmpty || goal == null || goal.isEmpty) {
    return null;
  }

  final exchange = field('Hình thức: ') ?? '';
  final direction = field('Chiều trao đổi: ') ?? '';
  final creditLine = field('Credit gợi ý cho toàn thỏa thuận: ') ?? '';
  final twoWay = exchange.contains('hai chiều');
  final teach = direction.contains('Tôi dạy');
  final creditMatch = RegExp(r'^(\d+(?:\.\d{1,2})?)').firstMatch(creditLine);
  final credit = creditMatch?.group(1) ?? creditLine.split(' ').first;
  final sessions = [
    for (final line in lines)
      if (RegExp(r'^Buổi\s+\d+:\s*').hasMatch(line))
        line.replaceFirst(RegExp(r'^Buổi\s+\d+:\s*'), '').trim(),
  ].where((line) => line.isNotEmpty).toList();

  return PathNegotiationSuggestion(
    raw: trimmed,
    twoWay: twoWay,
    teach: teach,
    skill: skill,
    goal: goal,
    credit: credit,
    sessions: sessions,
    exchangeLabel: exchange.isEmpty
        ? (twoWay ? 'Trao đổi hai chiều' : 'Học một chiều')
        : exchange,
    directionLabel: direction.isEmpty
        ? (teach ? 'Tôi dạy → bạn học' : 'Tôi mong muốn học từ bạn')
        : direction,
  );
}

String formatNegotiationMessage({
  required bool twoWay,
  required String role,
  required String skill,
  required String goal,
  required String credit,
  required List<String> lessons,
}) {
  final teach = twoWay || role == 'Tôi dạy';
  return [
    'GỢI Ý LỘ TRÌNH · CHƯA XÁC NHẬN',
    'Hình thức: ${twoWay ? 'Trao đổi hai chiều' : 'Học một chiều'}',
    'Chiều trao đổi: ${teach ? 'Tôi dạy → bạn học' : 'Tôi mong muốn học từ bạn'}',
    'Kỹ năng: $skill',
    'Mục tiêu: $goal',
    'Credit gợi ý cho toàn thỏa thuận: $credit${twoWay ? ' mỗi người' : ''}',
    for (var i = 0; i < lessons.length; i++) 'Buổi ${i + 1}: ${lessons[i]}',
    'Đây là nội dung thương lượng trong Chat. Người dạy tự tạo kế hoạch; kế hoạch và lịch cần xác nhận riêng. Chưa giữ Credit.',
  ].join('\n');
}

String conversationMessagePreview(String text) {
  final negotiation = readNegotiationMessage(text);
  return negotiation?.preview ?? text;
}
