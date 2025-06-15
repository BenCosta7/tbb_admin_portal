import 'package:file_picker/file_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';

class StorageService {
  final FirebaseStorage _storage = FirebaseStorage.instance;

  // --- GENERIC FILE UPLOAD METHOD ---
  // This function can upload any file to a specified path in Firebase Storage.
  // It returns a map containing the download URL and the storage path.
  Future<Map<String, String>> uploadFile(String path, PlatformFile file) async {
    try {
      final ref = _storage.ref().child(path);
      final uploadTask = await ref.putData(file.bytes!);
      final downloadUrl = await uploadTask.ref.getDownloadURL();

      return {'downloadUrl': downloadUrl, 'storagePath': path};
    } catch (e) {
      print('Error uploading file to Storage: $e');
      rethrow;
    }
  }

  // --- ADDED METHOD ---
  // This function deletes a file from Firebase Storage using its full path.
  Future<void> deleteFile(String storagePath) async {
    try {
      final ref = _storage.ref().child(storagePath);
      await ref.delete();
    } catch (e) {
      // Handle potential errors, e.g., file not found
      print('Error deleting file from storage: $e');
      // Re-throw the error if you want to handle it in the UI
      rethrow;
    }
  }
}
