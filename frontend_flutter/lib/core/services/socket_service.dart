import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter_riverpod/flutter_riverpod.dart';

final socketServiceProvider = Provider((ref) => SocketService());

class SocketService {
  late io.Socket socket;
  final String serverUrl = 'http://localhost:4000';

  void connect() {
    socket = io.io(serverUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });
    socket.connect();
    
    socket.onConnect((_) => print('Connected to WebSocket'));
    socket.onDisconnect((_) => print('Disconnected from WebSocket'));
  }

  void onNotification(Function(dynamic) callback) {
    socket.on('notification', (data) => callback(data));
  }

  void disconnect() {
    socket.disconnect();
  }
}
