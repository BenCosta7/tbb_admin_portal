import 'package:flutter/material.dart';
import 'package:tbb_admin_portal/services/admin_auth_service.dart';

class AdminDashboardScreen extends StatelessWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final adminAuthService = AdminAuthService();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: () {
              adminAuthService.signOut();
            },
          ),
        ],
      ),
      body: const Center(
        child: Text(
          'Dashboard Widgets Will Go Here',
          style: TextStyle(fontSize: 24, color: Colors.grey),
        ),
      ),
    );
  }
}
