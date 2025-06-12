import 'package:flutter/material.dart';
import 'package:tbb_admin_portal/services/admin_firestore_service.dart';

// Converted to a StatefulWidget to manage form state.
class ContentManagementScreen extends StatefulWidget {
  const ContentManagementScreen({super.key});

  @override
  State<ContentManagementScreen> createState() =>
      _ContentManagementScreenState();
}

class _ContentManagementScreenState extends State<ContentManagementScreen> {
  // Create an instance of our new service.
  final AdminFirestoreService _adminFirestoreService = AdminFirestoreService();

  // Controllers for the Course form
  final _courseTitleController = TextEditingController();
  final _courseDescriptionController = TextEditingController();

  // Controllers for the Book form
  final _bookTitleController = TextEditingController();
  final _bookAuthorController = TextEditingController();

  // This function calls our service to upload the course.
  void _uploadCourse() async {
    if (_courseTitleController.text.isNotEmpty &&
        _courseDescriptionController.text.isNotEmpty) {
      try {
        await _adminFirestoreService.uploadCourse(
          title: _courseTitleController.text,
          description: _courseDescriptionController.text,
        );

        _courseTitleController.clear();
        _courseDescriptionController.clear();

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Course uploaded successfully!')),
        );
      } catch (e) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
      }
    }
  }

  // This function calls our service to upload the book.
  void _uploadBook() async {
    if (_bookTitleController.text.isNotEmpty &&
        _bookAuthorController.text.isNotEmpty) {
      try {
        await _adminFirestoreService.uploadBook(
          title: _bookTitleController.text,
          author: _bookAuthorController.text,
        );

        _bookTitleController.clear();
        _bookAuthorController.clear();

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Book uploaded successfully!')),
        );
      } catch (e) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
      }
    }
  }

  @override
  void dispose() {
    // Clean up all controllers.
    _courseTitleController.dispose();
    _courseDescriptionController.dispose();
    _bookTitleController.dispose();
    _bookAuthorController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Content Management'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Upload New Content',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 24),
            // Course Upload Section
            _buildContentSection(
              title: 'Upload a New Course',
              formFields: [
                TextField(
                  controller: _courseTitleController,
                  decoration: const InputDecoration(labelText: 'Course Title'),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _courseDescriptionController,
                  decoration: const InputDecoration(
                    labelText: 'Course Description',
                  ),
                ),
              ],
              onUpload: _uploadCourse,
            ),
            const SizedBox(height: 32),
            // Book Upload Section
            _buildContentSection(
              title: 'Upload a New Book',
              formFields: [
                TextField(
                  controller: _bookTitleController,
                  decoration: const InputDecoration(labelText: 'Book Title'),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _bookAuthorController,
                  decoration: const InputDecoration(labelText: 'Author'),
                ),
              ],
              onUpload: _uploadBook,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContentSection({
    required String title,
    required List<Widget> formFields,
    required VoidCallback onUpload,
  }) {
    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ...formFields,
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onUpload,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
              ),
              child: const Text('Upload'),
            ),
          ],
        ),
      ),
    );
  }
}
