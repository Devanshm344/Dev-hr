const integrations = [
  { name: 'Salesforce',       initials: 'SF', bg: '#00A1E0' },
  { name: 'HubSpot',          initials: 'HS', bg: '#FF7A59' },
  { name: 'Slack',            initials: 'SL', bg: '#4A154B' },
  { name: 'Microsoft Teams',  initials: 'MS', bg: '#6264A7' },
  { name: 'Google Workspace', initials: 'GW', bg: '#4285F4' },
  { name: 'Jira',             initials: 'JI', bg: '#0052CC' },
  { name: 'GitHub',           initials: 'GH', bg: '#24292F' },
  { name: 'AWS',              initials: 'AW', bg: '#FF9900' },
];

export default function LandingIntegration() {
  return (
    <section className="container-section bg-transparent">
      <div className="section-container">
        <div className="text-center mb-12">
          <div className="section-tag justify-center mb-4">Integrations</div>
          <h2 className="section-heading mb-4 text-slate-900">Works With Your Apps</h2>
          <p className="section-subheading max-w-2xl mx-auto mb-0 text-slate-600">
            Connect with 500+ applications and services instantly.
          </p>
        </div>

        <div className="marquee-row relative overflow-hidden">
          <div className="marquee-fade left-0 bg-gradient-to-r from-white to-transparent" />
          <div className="marquee-fade right-0 bg-gradient-to-l from-white to-transparent" />
          <div className="marquee-track gap-6 py-2">
            {[...integrations, ...integrations].map((int, i) => (
              <div
                key={`${int.name}-${i}`}
                className="feature-card text-center py-8 w-48 shrink-0 hover:border-brand-primary hover:bg-brand-lightGray hover:-translate-y-1"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white text-sm font-bold shadow-md"
                  style={{ backgroundColor: int.bg }}
                >
                  {int.initials}
                </div>
                <p className="text-sm font-semibold text-brand-darkGray">{int.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12">
          <a href="#" className="text-brand-primary font-semibold hover:text-brand-primaryDark transition-colors">
            View all integrations →
          </a>
        </div>
      </div>
    </section>
  );
}
