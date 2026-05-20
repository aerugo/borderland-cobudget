import Link from "next/link";
import { useRouter } from "next/router";
import { useIntl } from "react-intl";

const freudTabs = (groupSlug: string, roundSlug: string) => [
  {
    label: "Dream Review",
    href: `/${groupSlug}/${roundSlug}/freud`,
  },
  {
    label: "Redistribution",
    href: `/${groupSlug}/${roundSlug}/freud/redistribution`,
  },
  {
    label: "Emails",
    href: `/${groupSlug}/${roundSlug}/freud/emails`,
  },
  {
    label: "Conversations",
    href: `/${groupSlug}/${roundSlug}/freud/conversations`,
  },
];

export default function FreudLayout({
  children,
  round,
  currentUser,
}: {
  children: React.ReactNode;
  round: any;
  currentUser: any;
}) {
  const router = useRouter();
  const groupSlug = router.query.group as string;
  const roundSlug = router.query.round as string;

  const isAdminOrMod =
    currentUser?.currentCollMember?.isAdmin ||
    currentUser?.currentCollMember?.isModerator ||
    currentUser?.currentGroupMember?.isAdmin;

  if (!isAdminOrMod || !round) return null;

  const color = round?.color ?? "anthracit";
  const tabs = freudTabs(groupSlug, roundSlug);

  const isActive = (href: string) => {
    if (href === `/${groupSlug}/${roundSlug}/freud`) {
      return router.asPath === href;
    }
    return router.asPath.startsWith(href);
  };

  return (
    <div className="max-w-screen-xl mx-auto px-2 md:px-4">
      <div className="flex space-x-2 border-b border-b-default mt-2">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`block px-3 py-3 border-b-2 font-medium text-sm transition-colors ${
              isActive(tab.href)
                ? `border-${color} text-${color}`
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="py-4">{children}</div>
    </div>
  );
}
