import '../http/app_error.dart';

const _rawApiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://skillhub.memora.cam/api/v1',
);

String normalizeApiUrl(String value) {
  final Uri url;
  try {
    url = Uri.parse(value.trim());
  } on FormatException {
    throw const AppError(AppErrorKind.config);
  }
  if (!(url.scheme == 'http' || url.scheme == 'https') ||
      url.host.isEmpty ||
      url.userInfo.isNotEmpty ||
      url.hasQuery ||
      url.hasFragment) {
    throw const AppError(AppErrorKind.config);
  }
  var path = url.path.replaceAll(RegExp(r'/+$'), '');
  if (path.isEmpty || path == '/api') path = '/api/v1';
  if (path != '/api/v1') throw const AppError(AppErrorKind.config);
  return '${url.origin}$path';
}

String getApiUrl() => normalizeApiUrl(_rawApiUrl);
