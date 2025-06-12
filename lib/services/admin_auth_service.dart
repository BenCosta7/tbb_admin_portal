import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AdminAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // This method signs in a user and checks if they are an admin.
  Future<UserCredential?> signInAdminWithEmailAndPassword(
    String email,
    String password,
  ) async {
    try {
      // Step 1: Sign in the user with regular Firebase Auth.
      final userCredential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password.trim(),
      );

      // Step 2: Check if the signed-in user has admin privileges.
      if (userCredential.user != null) {
        final userDoc = await _firestore
            .collection('users')
            .doc(userCredential.user!.uid)
            .get();

        // Check if the document exists and the 'isAdmin' field is true.
        if (userDoc.exists && userDoc.data()?['isAdmin'] == true) {
          // If they are an admin, return the user credential. Success!
          print("Admin user successfully logged in.");
          return userCredential;
        } else {
          // If they are not an admin, sign them out immediately.
          print("Login failed: User is not an admin.");
          await _auth.signOut();
          return null;
        }
      }
      return null;
    } on FirebaseAuthException catch (e) {
      // Handle login errors like wrong password, user not found, etc.
      print("Firebase Auth Exception: ${e.message}");
      return null;
    } catch (e) {
      print("An unexpected error occurred: $e");
      return null;
    }
  }

  // --- SIGN OUT METHOD ---
  Future<void> signOut() async {
    await _auth.signOut();
    print("Admin user signed out.");
  }
}
