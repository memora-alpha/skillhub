import '../../core/http/http_client.dart';
import '../learning_paths/service/study_service.dart';
import '../materials/service/materials_service.dart';
import '../learning_requests/service/learning_requests_service.dart';
import '../messages/service/conversations_service.dart';
import '../product_shell/service/notifications_service.dart';
import '../proposals/service/proposals_service.dart';
import '../skills/service/skills_service.dart';
import '../skills/service/verifications_service.dart';
import '../wallet/service/wallet_service.dart';

/// Learner endpoints beyond auth and account. Screens call these services,
/// which call an API class, which parses a schema.
class ProductServices {
  ProductServices(HttpClient client)
    : skills = SkillsService(client),
      verifications = VerificationsService(client),
      learningRequests = LearningRequestsService(client),
      proposals = ProposalsService(client),
      conversations = ConversationsService(client),
      notifications = NotificationsService(client),
      study = StudyService(client),
      wallet = WalletService(client),
      materials = MaterialsService(client);

  final SkillsService skills;
  final VerificationsService verifications;
  final LearningRequestsService learningRequests;
  final ProposalsService proposals;
  final ConversationsService conversations;
  final NotificationsService notifications;
  final StudyService study;
  final WalletService wallet;
  final MaterialsService materials;
}
