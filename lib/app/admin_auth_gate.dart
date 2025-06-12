import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:tbb_admin_portal/features/auth/admin_login_screen.dart';
import 'package:tbb_admin_portal/features/dashboard/admin_dashboard_screen.dart';

class AdminAuthGate extends StatelessWidget {
  const AdminAuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: StreamBuilder<User?>(
        stream: FirebaseAuth.instance.authStateChanges(),
        builder: (context, snapshot) {
          // If the snapshot has data, a user is logged in.
          if (snapshot.hasData) {
            // Show the Admin Dashboard.
            return const AdminDashboardScreen();
          } else {
            // If there's no data, show the Admin Login Screen.
            return const AdminLoginScreen();
          }
        },
      ),
    );
  }
}
