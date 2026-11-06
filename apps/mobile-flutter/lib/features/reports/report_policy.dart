const reportReasons = [
  'TECHNICAL_ISSUE',
  'INAPPROPRIATE_BEHAVIOR',
  'HARASSMENT',
  'SKILL_MISMATCH',
  'FALSE_INFORMATION',
  'CREDIT_ISSUE',
  'INAPPROPRIATE_CONTENT',
  'SPAM_SCAM',
  'OTHER',
];

bool canSubmitReportReason(Object? code) => reportReasons.contains(code);

String reportReasonLabel(String code) =>
    const {
      'NO_SHOW_LATE': 'Vắng học / đến muộn (báo cáo trước đây)',
      'TECHNICAL_ISSUE': 'Sự cố kỹ thuật',
      'INAPPROPRIATE_BEHAVIOR': 'Hành vi không phù hợp',
      'HARASSMENT': 'Quấy rối',
      'SKILL_MISMATCH': 'Kỹ năng không đúng mô tả',
      'FALSE_INFORMATION': 'Thông tin sai lệch',
      'CREDIT_ISSUE': 'Vấn đề Credit',
      'INAPPROPRIATE_CONTENT': 'Nội dung không phù hợp',
      'SPAM_SCAM': 'Spam / lừa đảo',
      'OTHER': 'Vấn đề khác',
    }[code] ??
    code;
