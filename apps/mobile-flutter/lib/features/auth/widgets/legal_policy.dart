import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Bundled from packages/content/legal-policies.ts, shared with web and Expo.
Future<void> showLegalPolicy(BuildContext context, String kind) => showDialog<void>(
  context: context,
  builder: (context) => Dialog(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 700, maxHeight: 720),
      child: Column(
        children: [
          AppBar(title: Text(kind == 'terms' ? 'Điều khoản sử dụng' : 'Chính sách bảo mật'), automaticallyImplyLeading: false, actions: [
            IconButton(tooltip: 'Đóng', onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close)),
          ]),
          Expanded(
            child: FutureBuilder<String>(
              future: rootBundle.loadString('assets/legal-policies.json'),
              builder: (context, snapshot) {
                if (snapshot.hasError) return const Center(child: Text('Chưa tải được chính sách. Đóng rồi mở lại để thử lại.'));
                if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
                final data = jsonDecode(snapshot.data!) as Map<String, dynamic>;
                final policy = data[kind] as Map<String, dynamic>;
                final sections = policy['sections'] as List<dynamic>;
                return SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Phiên bản ${data['version']} · ${data['updatedAt']}'),
                    const SizedBox(height: 12),
                    Text(data['notice'] as String),
                    const SizedBox(height: 16),
                    Text(policy['introduction'] as String),
                    for (final section in sections) ...[
                      const SizedBox(height: 20),
                      Text(section['title'] as String, style: Theme.of(context).textTheme.titleMedium),
                      for (final paragraph in section['paragraphs'] as List<dynamic>) Padding(
                        padding: const EdgeInsets.only(top: 10), child: Text(paragraph as String),
                      ),
                    ],
                  ]),
                );
              },
            ),
          ),
        ],
      ),
    ),
  ),
);
