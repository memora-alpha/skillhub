import 'package:flutter_riverpod/flutter_riverpod.dart';

class InboxCountNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void setCount(int value) => state = value;
}

final inboxCountProvider = NotifierProvider<InboxCountNotifier, int>(
  InboxCountNotifier.new,
);
