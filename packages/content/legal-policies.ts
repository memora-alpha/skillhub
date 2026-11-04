export const legalPolicies = {
  version: "2026-11-04-draft-3",
  updatedAt: "04/11/2026",
  notice:
    "Bản dự thảo do nhóm phát triển SkillHub chuẩn bị. Thông tin liên hệ, thời hạn lưu giữ dữ liệu và một số quy tắc Credit cần được hoàn thiện trước khi phát hành chính thức.",
  terms: {
    title: "Điều khoản sử dụng",
    introduction:
      "SkillHub do nhóm phát triển SkillHub vận hành, giúp người dùng kết nối để học, chia sẻ kỹ năng và trao đổi tài liệu. Điều khoản này giải thích trách nhiệm khi sử dụng các chức năng hiện có.",
    sections: [
      {
        id: "account",
        title: "Tài khoản và trách nhiệm của bạn",
        paragraphs: [
          "Cung cấp thông tin đăng ký chính xác, xác minh email và bảo vệ mật khẩu, mã OTP cùng phiên đăng nhập. Không chia sẻ tài khoản, mạo danh hoặc sử dụng tài khoản của người khác.",
          "Bạn có thể cập nhật hồ sơ, đặt lại mật khẩu và đăng xuất các thiết bị trong ứng dụng. Nếu phát hiện hoạt động bất thường, hãy đổi mật khẩu và kết thúc các phiên đang hoạt động.",
        ],
      },
      {
        id: "community",
        title: "Ứng xử và nội dung được chia sẻ",
        paragraphs: [
          "Trao đổi tôn trọng; không quấy rối, lừa đảo, spam, phát tán mã độc hoặc đăng tải nội dung trái pháp luật. Chỉ chia sẻ tài liệu, hình ảnh và bằng chứng mà bạn có quyền sử dụng; không công khai thông tin riêng tư của người khác khi chưa được phép.",
          "Bạn chịu trách nhiệm về tính chính xác của kỹ năng tự khai và nội dung cung cấp. Nhãn xác minh thể hiện kết quả xét duyệt bằng chứng trên nền tảng, không bảo đảm mọi kết quả học tập. Nhân sự có quyền phù hợp có thể xét duyệt nội dung, xử lý báo cáo và áp dụng hạn chế theo kết quả xác minh.",
        ],
      },
      {
        id: "agreement",
        title: "Thỏa thuận, kế hoạch và lịch học",
        paragraphs: [
          "Chấp nhận đề xuất chỉ mở trao đổi, chưa chốt buổi học. Học một chiều có một kế hoạch từ người dạy tới người học; trao đổi hai chiều có hai kế hoạch đối ứng, mỗi người tự tạo kế hoạch cho phần mình dạy.",
          "Người học xác nhận phiên bản kế hoạch hiện tại; cả hai cùng xác nhận điều khoản và lịch tương ứng. Tin nhắn không thay thế thao tác xác nhận. Buổi học kéo dài từ 60 đến 180 phút.",
          "Đổi lịch thông thường cần cả hai xác nhận cùng phiên bản ít nhất 60 phút trước giờ bắt đầu lịch cũ. Khi chưa đủ xác nhận hoặc máy chủ chưa áp dụng lịch mới, lịch cũ vẫn có hiệu lực. Lịch học bù áp dụng theo thời hạn học bù được hiển thị.",
        ],
      },
      {
        id: "attendance",
        title: "Tham gia, vắng học và học bù",
        paragraphs: [
          "Điểm danh dựa trên khoảng thời gian kết nối phòng học do máy chủ ghi nhận, không chỉ dựa vào việc bấm vào phòng. Cấu hình mặc định yêu cầu tham gia ít nhất 80% thời lượng; vào sau 10 phút được ghi nhận là đến muộn. Kết quả, thời hạn và quyền thao tác cụ thể được hiển thị trong chi tiết buổi học.",
          "Nếu chỉ người dạy có mặt và người học bị xác định vắng, sau thời hạn khiếu nại mà không có tranh chấp giữ kết quả, buổi được tính đã sử dụng và người học bị trừ 8 điểm uy tín. Nếu người dạy vắng hoặc cả hai vắng, buổi cần học bù và mỗi người bị xác định vắng bị trừ 8 điểm uy tín khi kết luận được chốt.",
          "Trong thời hạn mặc định 48 giờ sau khi buổi kết thúc, bên vắng có thể gửi lý do để bên còn lại xem xét. Lý do được chấp nhận dẫn tới học bù và không áp dụng phạt uy tín cho lần vắng đó. Cơ chế chấp nhận lý do giữa hai bên không áp dụng khi cả hai cùng vắng; khiếu nại được gửi qua báo cáo buổi học.",
          "Hạn mặc định để hai bên chốt lịch học bù là 7 ngày kể từ khi chuyển sang cần học bù. Quá hạn mà chưa chốt được lịch, hệ thống chuyển vụ việc cho nhân sự xử lý và giữ quyết toán. Khi có khiếu nại đang xử lý, kết quả vắng chưa tự chốt.",
          "Dữ liệu kết nối không đủ tin cậy được ghi là chưa xác minh được; trạng thái này không tự tạo phạt vắng. Tùy bằng chứng và xác nhận của hai bên, buổi có thể được hoàn tất theo thời hạn hoặc chuyển nhân sự xem xét. Bạn có thể báo cáo sự cố kỹ thuật trong chi tiết buổi học.",
        ],
      },
      {
        id: "completion",
        title: "Xác nhận hoàn thành",
        paragraphs: [
          "Sau khi dữ liệu điểm danh được tổng hợp, hai bên có thể xác nhận đã học nếu buổi đủ điều kiện. Không được xác nhận hoàn tất để bỏ qua kết luận có người vắng; hãy dùng giải trình hoặc báo cáo khi có sai lệch.",
          "Với cấu hình mặc định, thời hạn xác nhận là 24 giờ từ khi có kết luận điểm danh. Khi đủ dữ liệu chứng minh cả hai có mặt, hệ thống có thể hoàn tất buổi sau thời hạn dù chưa đủ hai xác nhận. Rời phòng không phải là xác nhận hoàn thành; hoàn thành một buổi cũng chưa phải quyết toán Credit.",
        ],
      },
      {
        id: "credit",
        title: "Credit, thanh toán và quyết toán",
        paragraphs: [
          "Tỷ lệ quy đổi hiện tại là 1.000 VND = 1 Credit. Credit dùng cho hoạt động học tập và tài liệu trên SkillHub; ứng dụng chưa hỗ trợ rút Credit thành tiền. Chỉ coi nạp tiền thành công khi máy chủ xác nhận và lịch sử ví ghi nhận giao dịch.",
          "Credit được giữ theo thỏa thuận. Chỉ quyết toán khi toàn bộ buổi đủ điều kiện hoàn tất, đã hết thời hạn khiếu nại áp dụng và không còn tranh chấp giữ quyết toán: trao đổi hai chiều hoàn 96% Credit đã giữ cho từng người, nền tảng giữ 4%; học một chiều trả 96% Credit thỏa thuận cho người dạy, nền tảng giữ 4%. Buổi tự hoàn tất sau thời hạn xác nhận không làm mất thời gian khiếu nại còn lại.",
          "Phí quyết toán 4% không phải tiền phạt vắng học. Tỷ lệ phạt, hoàn Credit riêng cho hủy muộn/vắng học và cách phân bổ theo buổi chưa được nhóm chốt đầy đủ; không có cam kết hoàn tự động theo một tỷ lệ cố định. Vụ việc cần điều chỉnh tài chính phải được xử lý theo quyền và có lịch sử giao dịch.",
        ],
      },
      {
        id: "materials",
        title: "Tài liệu và quyền sử dụng",
        paragraphs: [
          "Tài liệu miễn phí và trả Credit có quyền truy cập khác nhau. Kiểm tra mô tả, giá và quyền tải trước khi mua. Không phân phối lại tài liệu nếu không có quyền của chủ sở hữu.",
          "Yêu cầu hoàn Credit cho tài liệu trả phí hiện được kiểm tra trong 24 giờ từ khi mua, khi chưa được cấp đường dẫn tải và người bán còn đủ số Credit cần hoàn. Nếu không đủ điều kiện xử lý tự động, cần đưa vụ việc qua báo cáo để xem xét; mua tài liệu không tạo quyền rút Credit thành tiền.",
        ],
      },
      {
        id: "reports",
        title: "Báo cáo, hạn chế và quyền khiếu nại",
        paragraphs: [
          "Khi có vấn đề với buổi học, lộ trình, người dùng hoặc tài liệu, sử dụng chức năng báo cáo tương ứng và cung cấp mô tả, bằng chứng đúng sự thật. Theo dõi thời hạn trên màn chi tiết; mở báo cáo không đồng nghĩa chắc chắn được hoàn Credit hoặc xử lý theo kết quả mong muốn.",
          "Nhân sự được phân quyền xem xét bằng chứng và ra quyết định. Hạn chế tài khoản, thay đổi uy tín hoặc điều chỉnh Credit phải theo kết quả xử lý được ghi nhận. Quyền của người dùng theo pháp luật áp dụng không bị loại bỏ bởi điều khoản này.",
        ],
      },
      {
        id: "changes",
        title: "Cập nhật và thông tin liên hệ",
        paragraphs: [
          "Nhóm phát triển SkillHub hiện chưa công bố tên pháp nhân, địa chỉ hoặc email hỗ trợ chính thức. Các thông tin này và đầu mối tiếp nhận yêu cầu cần được công bố trước khi phát hành chính thức.",
          "Mỗi bản điều khoản cần có phiên bản và ngày cập nhật rõ ràng. Thay đổi quan trọng phải được thông báo và lấy lại xác nhận khi cần; bản dự thảo này không tự thay đổi các thỏa thuận hay giao dịch đã ghi nhận.",
        ],
      },
    ],
  },
  privacy: {
    title: "Chính sách bảo mật",
    introduction:
      "Nhóm phát triển SkillHub xử lý dữ liệu để cung cấp tài khoản, kết nối học tập, phòng học, ví Credit và tài liệu. Chính sách này mô tả dữ liệu được sử dụng trong các chức năng hiện có và những thông tin còn cần hoàn thiện.",
    sections: [
      {
        id: "data",
        title: "Dữ liệu được thu thập",
        paragraphs: [
          "Dữ liệu tài khoản gồm tên, email, thông tin xác minh, mật khẩu được băm trên máy chủ, phiên đăng nhập và thời điểm chấp nhận phiên bản điều khoản. Hồ sơ có thể có ảnh đại diện, giới thiệu, kỹ năng, bằng chứng xác minh, uy tín và danh hiệu.",
          "Dữ liệu hoạt động gồm bài đăng, đề xuất, tin nhắn và tệp đính kèm, kế hoạch/lịch học, các xác nhận, thời điểm vào/rời phòng, thời lượng kết nối, giải trình, đánh giá và báo cáo.",
          "Dữ liệu giao dịch gồm mã thanh toán, trạng thái nạp tiền, giao dịch Credit, khoản giữ/quyết toán và quyền mua tài liệu. Nhật ký kỹ thuật và kiểm toán có thể có thời điểm, địa chỉ IP, thông tin trình duyệt/thiết bị và mã lỗi; không đưa mật khẩu, OTP hoặc khóa bí mật vào nội dung chia sẻ công khai.",
        ],
      },
      {
        id: "purposes",
        title: "Mục đích sử dụng",
        paragraphs: [
          "Xác thực và bảo vệ tài khoản; hiển thị hồ sơ theo quyền; tìm kết nối phù hợp; trao đổi tin nhắn; lập kế hoạch, tổ chức buổi học và gửi thông báo liên quan.",
          "Đối soát giao dịch và Credit; kiểm soát quyền tải tài liệu; ghi nhận điểm danh; giải quyết vắng học, học bù, báo cáo và tranh chấp; phát hiện lạm dụng và kiểm toán hoạt động. Việc sử dụng dữ liệu cho mục đích mới cần được thông báo và có căn cứ phù hợp.",
        ],
      },
      {
        id: "visibility",
        title: "Dữ liệu công khai và dữ liệu hạn chế",
        paragraphs: [
          "Hồ sơ công khai có thể hiển thị tên, ảnh đại diện, giới thiệu, kỹ năng chia sẻ, trạng thái xác minh, uy tín và danh hiệu theo quyền hiển thị. Bài đăng và tài liệu được công bố sẽ được người khác xem trong phạm vi chức năng tương ứng.",
          "Email đăng nhập, thông tin thanh toán, bằng chứng xác minh riêng tư và tệp riêng tư không thuộc hồ sơ công khai. Tin nhắn và nội dung thỏa thuận được cung cấp cho các bên có quyền truy cập; nhân sự được phân quyền có thể tiếp cận dữ liệu cần thiết để xét duyệt hoặc xử lý báo cáo.",
          "Người nhận nội dung vẫn có thể tự lưu hoặc chụp màn hình. Không gửi mật khẩu, OTP, dữ liệu thanh toán nhạy cảm hoặc thông tin riêng tư không cần thiết qua bài đăng và tin nhắn.",
        ],
      },
      {
        id: "providers",
        title: "Nhà cung cấp dịch vụ",
        paragraphs: [
          "Tùy cấu hình triển khai, SkillHub sử dụng LiveKit cho phòng học, payOS cho thanh toán, dịch vụ email để gửi mã/thông báo và hạ tầng lưu trữ để chứa tệp. Đăng nhập Google và thông báo đẩy chỉ dùng nhà cung cấp tương ứng khi chức năng đó được bật.",
          "Các dịch vụ chỉ nhận dữ liệu cần cho chức năng tương ứng, như thông tin kết nối phòng học hoặc mã và trạng thái thanh toán. Danh sách nhà cung cấp thực tế, nơi lưu trữ và hoạt động chuyển dữ liệu ra nước ngoài cần được nhóm công bố theo môi trường phát hành; bản dự thảo không xác nhận dữ liệu chỉ lưu tại Việt Nam.",
        ],
      },
      {
        id: "permissions",
        title: "Quyền camera, micro, ảnh và tệp",
        paragraphs: [
          "Camera và micro phục vụ việc bật hình/tiếng trong phòng học. Chọn ảnh/tệp phục vụ ảnh đại diện, bằng chứng, tin nhắn, tài liệu hoặc báo cáo do bạn chủ động gửi. Bạn có thể từ chối hoặc thu hồi quyền trong cài đặt thiết bị/trình duyệt; chức năng tương ứng có thể bị giới hạn.",
          "Bạn có thể chủ động chia sẻ màn hình trên thiết bị được hỗ trợ và dừng chia sẻ trong phòng. Nội dung màn hình có thể được người tham gia nhìn thấy; kiểm tra thông tin riêng tư trước khi chia sẻ.",
          "Chat trong phòng học chỉ được truyền trong phiên và giữ tạm trong bộ nhớ của ứng dụng, không ghi vào lịch sử tin nhắn SkillHub. Rời phòng hoặc tải lại sẽ mất nội dung; người vào sau không nhận lại các tin trước đó. Tin nhắn trong mục Trò chuyện thông thường vẫn có lịch sử riêng.",
          "Mã nguồn hiện tại không triển khai ghi hình hoặc ghi âm buổi học trên máy chủ. Điểm danh lưu thông tin kết nối và thời lượng, không phải bản ghi nội dung hình/tiếng. Điều này không ngăn người tham gia dùng công cụ ngoài để ghi lại; cần có sự đồng ý phù hợp trước khi ghi hoặc chia sẻ buổi học.",
        ],
      },
      {
        id: "storage",
        title: "Phiên đăng nhập và bảo vệ dữ liệu",
        paragraphs: [
          "Web dùng cookie phiên đăng nhập có HttpOnly; mobile lưu thông tin đăng nhập bằng cơ chế lưu trữ an toàn của thiết bị. Ứng dụng còn dùng bộ nhớ/bộ đệm để giữ trạng thái màn hình và bản nháp; đăng xuất không đồng nghĩa xóa mọi dữ liệu đã lưu trên máy chủ.",
          "Máy chủ kiểm tra quyền và giới hạn truy cập tệp riêng tư; một số đường dẫn tải chỉ có hiệu lực ngắn. Các biện pháp này không phải cam kết an toàn tuyệt đối hoặc mã hóa đầu cuối cho mọi nội dung. Bảo vệ thiết bị, khóa màn hình và không chia sẻ đường dẫn riêng tư.",
        ],
      },
      {
        id: "retention",
        title: "Thời hạn lưu giữ và xóa dữ liệu",
        paragraphs: [
          "Nhóm chưa chốt thời hạn lưu giữ cụ thể cho từng nhóm dữ liệu, bản sao lưu, nhật ký kiểm toán và bằng chứng điểm danh. Cần công bố thời hạn, mục đích và cách xóa/ẩn danh trước khi phát hành chính thức.",
          "Ứng dụng hiện chưa có chức năng tự phục vụ để xóa toàn bộ tài khoản và dữ liệu. Chỉnh sửa/ẩn nội dung hoặc đăng xuất không có nghĩa mọi bản sao, tin nhắn của người nhận hay lịch sử giao dịch đã được xóa. Việc giữ dữ liệu phục vụ tranh chấp và nghĩa vụ pháp lý cần được nêu rõ trong chính sách chính thức.",
        ],
      },
      {
        id: "rights",
        title: "Quyền và lựa chọn của bạn",
        paragraphs: [
          "Bạn có thể xem/cập nhật thông tin hồ sơ được hỗ trợ, quản lý kỹ năng chia sẻ, đổi mật khẩu, đăng xuất các thiết bị và quản lý quyền thiết bị.",
          "Bạn có quyền được biết về xử lý dữ liệu, yêu cầu truy cập, chỉnh sửa, cung cấp, xóa hoặc hạn chế xử lý, phản đối hoặc rút lại sự đồng ý trong phạm vi pháp luật áp dụng. Bạn cũng có thể khiếu nại và yêu cầu bảo vệ quyền lợi theo pháp luật. Các quyền này không đồng nghĩa hệ thống đã có sẵn nút thực hiện tự động.",
          "Nhóm cần công bố đầu mối và quy trình tiếp nhận, xác minh, xử lý yêu cầu dữ liệu cũng như thông báo sự cố. Hiện chưa có email/quy trình chính thức để cam kết thời gian phản hồi; không nên gửi thêm giấy tờ nhạy cảm qua kênh chưa được xác nhận.",
        ],
      },
      {
        id: "updates",
        title: "Đơn vị phụ trách và cập nhật",
        paragraphs: [
          "Đơn vị vận hành hiện được xác định là nhóm phát triển SkillHub. Tên pháp nhân/người chịu trách nhiệm, địa chỉ, email hỗ trợ/quyền riêng tư và quy định sử dụng đối với người chưa thành niên chưa được công bố đầy đủ.",
          "Chính sách cần được cập nhật khi thay đổi mục đích xử lý, loại dữ liệu hoặc nhà cung cấp; các thay đổi quan trọng cần được thông báo và lấy sự đồng ý khi pháp luật yêu cầu. Ngày cập nhật và phiên bản của bản đang hiển thị được ghi ở đầu tài liệu.",
        ],
      },
    ],
  },
} as const;
