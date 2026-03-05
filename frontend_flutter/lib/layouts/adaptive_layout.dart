import 'package:flutter/material.dart';

class AdaptiveLayout extends StatelessWidget {
  final Widget body;
  final Widget? sideBar;
  final Widget? bottomNav;
  final Widget? appBar;
  final Widget? drawer;

  const AdaptiveLayout({
    super.key,
    required this.body,
    this.sideBar,
    this.bottomNav,
    this.appBar,
    this.drawer,
  });

  static bool isMobile(BuildContext context) =>
      MediaQuery.of(context).size.width < 600;

  static bool isTablet(BuildContext context) =>
      MediaQuery.of(context).size.width >= 600 &&
      MediaQuery.of(context).size.width < 1024;

  static bool isDesktop(BuildContext context) =>
      MediaQuery.of(context).size.width >= 1024;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: appBar != null
          ? PreferredSize(
              preferredSize: const Size.fromHeight(kToolbarHeight),
              child: appBar!,
            )
          : null,
      drawer: isMobile(context) ? drawer : null,
      bottomNavigationBar: isMobile(context) ? bottomNav : null,
      body: Row(
        children: [
          if (!isMobile(context) && sideBar != null) sideBar!,
          Expanded(child: body),
        ],
      ),
    );
  }
}
