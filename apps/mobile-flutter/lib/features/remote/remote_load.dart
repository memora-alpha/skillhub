import 'dart:math';

import '../../core/http/http_client.dart';

/// Follows cursor pages. Stops after 20 pages so a bad cursor cannot loop.
Future<List<T>> drainPages<T>(
  Future<Page<T>> Function(String? cursor) load,
) async {
  final items = <T>[];
  String? cursor;
  for (var page = 0; page < 20; page++) {
    final result = await load(cursor);
    items.addAll(result.items);
    final next = result.nextCursor;
    if (next == null || next.isEmpty) break;
    cursor = next;
  }
  return items;
}

String newUuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = [for (final byte in bytes) byte.toRadixString(16).padLeft(2, '0')];
  return '${hex.sublist(0, 4).join()}-${hex.sublist(4, 6).join()}-'
      '${hex.sublist(6, 8).join()}-${hex.sublist(8, 10).join()}-'
      '${hex.sublist(10).join()}';
}
