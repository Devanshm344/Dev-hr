import TechLogo from '../../assets/techdemocracy-new-logo.jpg';

const footerColumns = [
  {
    title: 'Solutions',
    links: [
      'Identity Governance & Administration (IGA)',
      'Customer Identity Access Management (CIAM)',
      'Privileged Access Management (PAM)',
      'Access Management (AM)',
      'Managed Security Operation Center (SOC)',
    ],
  },
  {
    title: 'Services',
    links: [
      'Advisory Consulting',
      'Implementation Services',
      'Operation & Support Services',
      'Managed Services',
      'FMMS',
      'WFaaS',
    ],
  },
  {
    title: 'Our Company',
    links: ['About Us', 'Leadership Team', 'Resources', 'Careers', 'Events', 'Workshop'],
  },
];

const legalLinks = ['Privacy Policy', 'Cookie Policy', 'Terms & Conditions'];

export default function LandingFooter() {
  return (
    <footer className="bg-brand-darkGray text-white">
      <div className="section-container py-16">
        <div className="flex items-center gap-3 mb-12">
          <img
            src={TechLogo}
            alt="TechDemocracy"
            className="w-10 h-10 object-contain rounded-full"
          />
          <span className="font-heading font-bold text-2xl">TechDemocracy</span>
        </div>

        <div className="grid lg:grid-cols-4 gap-12 mb-12">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="font-bold mb-4">{col.title}</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="font-bold mb-4">Head Office: United States</h4>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              1 Corporate Place South Suite # 110, Piscataway, NJ 08854. Call Us : +1 732 404 8350
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Email us :<br />
              <a href="mailto:solutions@techdemocracy.com" className="underline hover:text-white transition-colors">
                solutions@techdemocracy.com
              </a>
            </p>
            <div>
              <p className="font-bold text-sm mb-2">Delivery Centers :</p>
              <p className="text-sm text-gray-400">Canada&nbsp; | &nbsp;India&nbsp; | &nbsp;Philippines</p>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold mb-8">Your Trusted Identity Security Partner</h3>

        <div className="border-t border-gray-700 pt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm text-gray-400">
          <span>© 2026 TechDemocracy LLC and/or its affiliates. All rights reserved.</span>
          {legalLinks.map((label) => (
            <span key={label} className="flex items-center gap-2">
              <span className="text-gray-600">|</span>
              <a href="#" className="hover:text-white transition-colors">{label}</a>
            </span>
          ))}
          <span className="flex items-center gap-2">
            <span className="text-gray-600">|</span>
            <span>We are ISO/IEC 27001:2013 certified</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
