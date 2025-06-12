import 'package:cloud_firestore/cloud_firestore.dart';

class AdminFirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

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

  Future<void> uploadBook({
    required String title,
    required String author,
  }) async {
    try {
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

  Stream<QuerySnapshot> getUsersStream() {
    return _db
        .collection('users')
        .orderBy('created_at', descending: true)
        .snapshots();
  }

  Future<void> createLabReportRecord({
    required String uid,
    required String fileName,
    required String downloadUrl,
    required String storagePath,
  }) async {
    try {
      await _db.collection('users').doc(uid).collection('lab_reports').add({
        'fileName': fileName,
        'downloadUrl': downloadUrl,
        'storagePath': storagePath,
        'uploadedAt': Timestamp.now(),
      });
      print('Lab report record created successfully in Firestore.');
    } catch (e) {
      print('Error creating lab report record: $e');
      rethrow;
    }
  }

  Stream<QuerySnapshot> getLabReportsStream(String uid) {
    return _db
        .collection('users')
        .doc(uid)
        .collection('lab_reports')
        .orderBy('uploadedAt', descending: true)
        .snapshots();
  }

  Future<void> sendMessage({
    required String uid,
    required String messageText,
  }) async {
    try {
      await _db.collection('users').doc(uid).collection('messages').add({
        'text': messageText,
        'sentAt': Timestamp.now(),
        'sentBy': 'admin',
      });
      print('Message sent successfully.');
    } catch (e) {
      print('Error sending message: $e');
      rethrow;
    }
  }

  Stream<QuerySnapshot> getMessagesStream(String uid) {
    return _db
        .collection('users')
        .doc(uid)
        .collection('messages')
        .orderBy('sentAt', descending: false)
        .snapshots();
  }

  // --- ADD NOTE ---
  // Adds a note to a subcollection within a user's document.
  Future<void> addNote({required String uid, required String noteText}) async {
    try {
      await _db.collection('users').doc(uid).collection('notes').add({
        'text': noteText,
        'createdAt': Timestamp.now(),
      });
      print('Note added successfully.');
    } catch (e) {
      print('Error adding note: $e');
      rethrow;
    }
  }

  // --- GET NOTES STREAM ---
  // Reads the notes for a specific user.
  Stream<QuerySnapshot> getNotesStream(String uid) {
    return _db
        .collection('users')
        .doc(uid)
        .collection('notes')
        .orderBy('createdAt', descending: true) // Show newest notes first
        .snapshots();
  }
}
