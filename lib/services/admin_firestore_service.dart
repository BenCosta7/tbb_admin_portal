import 'package:cloud_firestore/cloud_firestore.dart';

class AdminFirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // --- UPLOAD NEW COURSE ---
  Future<void> uploadCourse({
    required String title,
    required String description,
  }) async {
    try {
      await _db.collection('courses').add({
        'title': title,
        'description': description,
        'uploadedAt': Timestamp.now(),
      });
      print('Course uploaded successfully!');
    } catch (e) {
      print('Error uploading course: $e');
      rethrow;
    }
  }

  // --- UPLOAD NEW BOOK ---
  Future<void> uploadBook({
    required String title,
    required String author,
  }) async {
    try {
      // Add to a new 'books' collection.
      await _db.collection('books').add({
        'title': title,
        'author': author,
        'uploadedAt': Timestamp.now(),
      });
      print('Book uploaded successfully!');
    } catch (e) {
      print('Error uploading book: $e');
      rethrow;
    }
  }
}
