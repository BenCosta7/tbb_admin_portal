import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:tbb_admin_portal/services/admin_firestore_service.dart';
import 'package:tbb_admin_portal/features/patients/patient_detail_screen.dart';

// Using singular 'PatientScreen' to match filename and convention
class PatientScreen extends StatefulWidget {
  const PatientScreen({super.key});

  @override
  State<PatientScreen> createState() => _PatientScreenState();
}

class _PatientScreenState extends State<PatientScreen> {
  final AdminFirestoreService _adminFirestoreService = AdminFirestoreService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('All Patients'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: _adminFirestoreService.getUsersStream(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(child: Text('Something went wrong.'));
          }
          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
            return const Center(child: Text('No patients found.'));
          }

          final patients = snapshot.data!.docs;

          return ListView.builder(
            padding: const EdgeInsets.all(16.0),
            itemCount: patients.length,
            itemBuilder: (context, index) {
              final patient = patients[index];
              final patientData = patient.data() as Map<String, dynamic>;

              return Card(
                margin: const EdgeInsets.only(bottom: 16.0),
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: Text(patientData['email'] ?? 'No Email'),
                  subtitle: Text('UID: ${patientData['uid'] ?? 'No UID'}'),
                  onTap: () {
                    // Navigate to the detail screen, passing the patient data.
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) =>
                            PatientDetailScreen(patient: patient),
                      ),
                    );
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}
