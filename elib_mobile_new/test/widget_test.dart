import 'package:flutter_test/flutter_test.dart';
import 'package:elib_mobile_new/main.dart';

void main() {
  testWidgets('app builds', (WidgetTester tester) async {
    await tester.pumpWidget(const ELibMobileApp());
    expect(find.text('E-Library Mobile'), findsOneWidget);
  });
}