import 'package:flutter/material.dart';
import '../../core/services/document_service.dart';
import '../../core/theme/app_colors.dart';

class DocumentGeneratorPage extends StatefulWidget {
  const DocumentGeneratorPage({super.key});

  @override
  State<DocumentGeneratorPage> createState() => _DocumentGeneratorPageState();
}

class _DocumentGeneratorPageState extends State<DocumentGeneratorPage> {
  final _service = DocumentService();
  bool _isLoading = false;
  DocumentType _selectedType = DocumentType.examProposal;

  final _courseController = TextEditingController(text: 'CS101: Computer Science');
  final _semesterController = TextEditingController(text: 'Spring 2026');
  final _facultyController = TextEditingController(text: 'Dr. John Doe');

  Future<void> _generate() async {
    setState(() => _isLoading = true);
    try {
      await _service.generateDocument(_selectedType, {
        'course': _courseController.text,
        'semester': _semesterController.text,
        'faculty': _facultyController.text,
        'timestamp': DateTime.now().toIso8601String(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Document generated successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Document Generator')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Generate Academic Documents',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Fill in the details below to generate a production-ready PDF.',
              style: TextStyle(color: AppColors.mediumGray),
            ),
            const SizedBox(height: 32),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Document Type', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<DocumentType>(
                      value: _selectedType,
                      decoration: const InputDecoration(fillColor: Colors.transparent),
                      items: const [
                        DropdownMenuItem(value: DocumentType.examProposal, child: Text('Exam Proposal')),
                        DropdownMenuItem(value: DocumentType.examReport, child: Text('Exam Report')),
                      ],
                      onChanged: (val) => setState(() => _selectedType = val!),
                    ),
                    const SizedBox(height: 24),
                    const Text('Course Name', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextField(controller: _courseController),
                    const SizedBox(height: 16),
                    const Text('Semester', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextField(controller: _semesterController),
                    const SizedBox(height: 16),
                    const Text('Faculty Name', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    TextField(controller: _facultyController),
                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: _isLoading ? null : _generate,
                      child: _isLoading
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Generate PDF'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
