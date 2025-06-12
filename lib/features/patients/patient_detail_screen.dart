import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart'; // Package for date formatting
// Import both services
import 'package:tbb_admin_portal/services/admin_firestore_service.dart';
import 'package:tbb_admin_portal/services/storage_service.dart';
import 'package:url_launcher/url_launcher.dart';

class PatientDetailScreen extends StatefulWidget {
  final QueryDocumentSnapshot patient;

  const PatientDetailScreen({super.key, required this.patient});

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen> {
  // Create instances of both services
  final AdminFirestoreService _adminFirestoreService = AdminFirestoreService();
  final StorageService _storageService = StorageService();
  bool _isUploading = false;

  // Controller for the message input
  final _messageController = TextEditingController();
  // Controller for the note input
  final _noteController = TextEditingController();

  Future<void> _pickAndUploadLabReport() async {
    setState(() {
      _isUploading = true;
    });

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );

      if (result != null && result.files.single.bytes != null) {
        final file = result.files.single;
        final patientId = widget.patient.id;

        // Step 1: Upload file to Storage using StorageService
        final String path = 'lab_reports/$patientId/${file.name}';
        final uploadResult = await _storageService.uploadFile(path, file);

        // Step 2: Create record in Firestore using AdminFirestoreService
        await _adminFirestoreService.createLabReportRecord(
          uid: patientId,
          fileName: file.name,
          downloadUrl: uploadResult['downloadUrl']!,
          storagePath: uploadResult['storagePath']!,
        );

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lab report uploaded successfully!')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('File selection canceled.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
    } finally {
      if (mounted) {
        setState(() {
          _isUploading = false;
        });
      }
    }
  }

  Future<void> _sendMessage() async {
    if (_messageController.text.trim().isEmpty) return;

    try {
      await _adminFirestoreService.sendMessage(
        uid: widget.patient.id,
        messageText: _messageController.text.trim(),
      );
      _messageController.clear();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error sending message: ${e.toString()}')),
      );
    }
  }

  Future<void> _addNote() async {
    if (_noteController.text.trim().isEmpty) return;

    try {
      await _adminFirestoreService.addNote(
        uid: widget.patient.id,
        noteText: _noteController.text.trim(),
      );
      _noteController.clear();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error adding note: ${e.toString()}')),
      );
    }
  }

  Future<void> _launchURL(String urlString) async {
    final Uri url = Uri.parse(urlString);
    if (!await launchUrl(url)) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not launch $urlString')));
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final patientData = widget.patient.data() as Map<String, dynamic>;
    final patientEmail = patientData['email'] ?? 'No Email';
    final patientUid = patientData['uid'] ?? 'No UID';
    final createdAtTimestamp = patientData['created_at'] as Timestamp?;
    final createdAtDate = createdAtTimestamp != null
        ? DateFormat.yMMMd().format(createdAtTimestamp.toDate())
        : 'N/A';

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text(patientEmail),
          backgroundColor: Colors.indigo,
          foregroundColor: Colors.white,
          bottom: const TabBar(
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: Colors.white,
            tabs: [
              Tab(icon: Icon(Icons.summarize), text: 'Summary'),
              Tab(icon: Icon(Icons.science), text: 'Labs/Imaging'),
              Tab(icon: Icon(Icons.chat), text: 'Communication'),
              Tab(icon: Icon(Icons.note_alt), text: 'Notes/Plan'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Summary Tab
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: ListView(
                children: [
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.email),
                      title: const Text('Email'),
                      subtitle: Text(patientEmail),
                    ),
                  ),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.vpn_key),
                      title: const Text('User ID'),
                      subtitle: Text(patientUid),
                    ),
                  ),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.calendar_today),
                      title: const Text('Member Since'),
                      subtitle: Text(createdAtDate),
                    ),
                  ),
                ],
              ),
            ),

            // Labs/Imaging Tab
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ElevatedButton.icon(
                    icon: _isUploading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 3,
                            ),
                          )
                        : const Icon(Icons.upload_file),
                    label: Text(
                      _isUploading ? 'Uploading...' : 'Upload Lab Report (PDF)',
                    ),
                    onPressed: _isUploading ? null : _pickAndUploadLabReport,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Uploaded Lab Reports',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const Divider(),
                  Expanded(
                    child: StreamBuilder<QuerySnapshot>(
                      stream: _adminFirestoreService.getLabReportsStream(
                        widget.patient.id,
                      ),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState ==
                            ConnectionState.waiting) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }
                        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                          return const Center(
                            child: Text(
                              'No lab reports found for this patient.',
                            ),
                          );
                        }

                        final labDocs = snapshot.data!.docs;
                        return ListView.builder(
                          itemCount: labDocs.length,
                          itemBuilder: (context, index) {
                            final labData =
                                labDocs[index].data() as Map<String, dynamic>;
                            final downloadUrl = labData['downloadUrl'];

                            return ListTile(
                              leading: const Icon(
                                Icons.picture_as_pdf,
                                color: Colors.red,
                              ),
                              title: Text(labData['fileName'] ?? 'No Filename'),
                              onTap: downloadUrl != null
                                  ? () => _launchURL(downloadUrl)
                                  : null,
                            );
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),

            // Communication Tab
            Column(
              children: [
                Expanded(
                  child: StreamBuilder<QuerySnapshot>(
                    stream: _adminFirestoreService.getMessagesStream(
                      widget.patient.id,
                    ),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                        return const Center(child: Text('No messages yet.'));
                      }
                      final messages = snapshot.data!.docs;
                      return ListView.builder(
                        padding: const EdgeInsets.all(8.0),
                        itemCount: messages.length,
                        itemBuilder: (context, index) {
                          final message =
                              messages[index].data() as Map<String, dynamic>;
                          final bool isAdmin = message['sentBy'] == 'admin';
                          return Align(
                            alignment: isAdmin
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Card(
                              color: isAdmin
                                  ? Colors.indigo[100]
                                  : Colors.grey[300],
                              child: Padding(
                                padding: const EdgeInsets.all(12.0),
                                child: Text(message['text'] ?? ''),
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _messageController,
                          decoration: const InputDecoration(
                            hintText: 'Type a message...',
                            border: OutlineInputBorder(),
                          ),
                          onSubmitted: (_) => _sendMessage(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.send),
                        onPressed: _sendMessage,
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.indigo,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Notes/Plan Tab
            Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _noteController,
                          decoration: const InputDecoration(
                            hintText: 'Add a new note or plan item...',
                            border: OutlineInputBorder(),
                          ),
                          onSubmitted: (_) => _addNote(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.add_comment),
                        onPressed: _addNote,
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.indigo,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(),
                Expanded(
                  child: StreamBuilder<QuerySnapshot>(
                    stream: _adminFirestoreService.getNotesStream(
                      widget.patient.id,
                    ),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                        return const Center(child: Text('No notes yet.'));
                      }
                      final notes = snapshot.data!.docs;
                      return ListView.builder(
                        padding: const EdgeInsets.all(8.0),
                        itemCount: notes.length,
                        itemBuilder: (context, index) {
                          final note =
                              notes[index].data() as Map<String, dynamic>;
                          final timestamp = note['createdAt'] as Timestamp?;
                          final date = timestamp?.toDate();
                          final formattedDate = date != null
                              ? DateFormat.yMMMd().add_jm().format(date)
                              : 'No date';

                          return Card(
                            margin: const EdgeInsets.only(bottom: 8.0),
                            child: ListTile(
                              title: Text(note['text'] ?? ''),
                              subtitle: Text('Added on: $formattedDate'),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
