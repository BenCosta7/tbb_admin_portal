import 'package:cloud_firestore/cloud_firestore.dart';

class AdminFirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // --- Methods for content management ---
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
    } catch (e) {
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
    } catch (e) {
      rethrow;
    }
  }

  // --- Methods for patient management ---
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
    } catch (e) {
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

  // --- ADDED METHOD ---
  // Deletes a specific lab report document from the subcollection.
  Future<void> deleteLabReport(String uid, String labReportId) async {
    try {
      await _db
          .collection('users')
          .doc(uid)
          .collection('lab_reports')
          .doc(labReportId)
          .delete();
    } catch (e) {
      print('Error deleting lab report record: $e');
      rethrow;
    }
  }
  // --- END OF ADDED METHOD ---

  Future<List<QueryDocumentSnapshot>> getLabReportsOnce(String uid) async {
    try {
      final snapshot = await _db
          .collection('users')
          .doc(uid)
          .collection('lab_reports')
          .get();
      print(
        "Manual fetch found ${snapshot.docs.length} documents for user $uid.",
      );
      return snapshot.docs;
    } catch (e) {
      print('Error in getLabReportsOnce: $e');
      rethrow;
    }
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
    } catch (e) {
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

  Future<void> addNote({required String uid, required String noteText}) async {
    try {
      await _db.collection('users').doc(uid).collection('notes').add({
        'text': noteText,
        'createdAt': Timestamp.now(),
      });
    } catch (e) {
      rethrow;
    }
  }

  Stream<QuerySnapshot> getNotesStream(String uid) {
    return _db
        .collection('users')
        .doc(uid)
        .collection('notes')
        .orderBy('createdAt', descending: true)
        .snapshots();
  }

  Future<void> addStructuredLabResult({
    required String uid,
    required String labName,
    required num value,
    required String unit,
    required DateTime date,
  }) async {
    try {
      await _db
          .collection('users')
          .doc(uid)
          .collection('structured_lab_results')
          .add({
            'labName': labName,
            'value': value,
            'unit': unit,
            'date': Timestamp.fromDate(date),
          });
    } catch (e) {
      rethrow;
    }
  }
}
