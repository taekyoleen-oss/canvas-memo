export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold mb-6">개인정보 처리 방침</h1>
      <p className="text-gray-500 mb-8">최종 업데이트: 2026년 4월 25일</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">수집하는 정보</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>이메일 주소 (로그인 및 계정 식별용)</li>
          <li>사용자가 직접 저장한 메모, 스크랩 텍스트 및 이미지</li>
          <li>북마크 URL 및 제목</li>
          <li>캔버스 보드 구성 정보 (위치, 크기, 연결)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">정보 저장 방법</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>모든 데이터는 Supabase(PostgreSQL) 클라우드 데이터베이스에 저장됩니다.</li>
          <li>Chrome 확장 프로그램은 chrome.storage.local을 오프라인 캐시로 사용합니다.</li>
          <li>Row Level Security(RLS)를 통해 사용자 본인의 데이터만 접근 가능합니다.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">제3자 공유</h2>
        <p className="text-gray-700">
          수집한 정보는 제3자에게 판매하거나 공유하지 않습니다. 서비스 운영에 필요한 Supabase
          인프라 서비스만 이용합니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Chrome 확장 프로그램 권한</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li><strong>activeTab, scripting</strong>: 현재 탭에서 텍스트/이미지 스크랩 및 OCR 기능</li>
          <li><strong>contextMenus</strong>: 마우스 우클릭 메뉴에서 스크랩 저장</li>
          <li><strong>storage</strong>: 오프라인 데이터 로컬 캐시</li>
          <li><strong>clipboardWrite/Read</strong>: 스크린샷 클립보드 복사</li>
          <li><strong>tabs, sidePanel</strong>: 사이드 패널 UI 및 탭 정보 접근</li>
          <li><strong>downloads</strong>: 스크린샷 파일 다운로드</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">데이터 삭제</h2>
        <p className="text-gray-700">
          언제든지 앱 내 데이터 관리 메뉴에서 데이터를 삭제할 수 있습니다.
          계정 삭제를 원하시면 이메일로 문의해 주세요.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">문의</h2>
        <p className="text-gray-700">
          개인정보 처리에 관한 문의사항이 있으시면 아래로 연락해 주세요.
        </p>
        <p className="mt-2 text-gray-700">이메일: taekyoleen@gmail.com</p>
      </section>
    </main>
  );
}
