import { useState } from 'react';
import { useAuth } from '../lib/authContext';
import '../styles/NavbarAccordion.css';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  subItems?: NavItem[];
  action?: () => void;
  requiresAccess?: (user: any) => boolean;
}

interface NavbarAccordionProps {
  onNavigate: (section: string, tab: string) => void;
  currentSection: string;
  currentTab: string;
  onLogout: () => void;
}

export default function NavbarAccordion({ onNavigate, currentSection, currentTab, onLogout }: NavbarAccordionProps) {
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['min-side'])); // Min Side open by default

  const navItems: NavItem[] = [
    {
      id: 'min-side',
      label: 'Min Side',
      icon: '🔐',
      subItems: [
        { id: 'ms-status', label: 'Status', icon: '📊' },
        { id: 'ms-rekorder', label: 'Rekorder', icon: '🏆' },
        { id: 'ms-lonn', label: 'Min Lønn', icon: '💰' },
        { id: 'ms-kalender', label: 'Min Kalender', icon: '📅' },
      ],
    },
    {
      id: 'min-avdeling',
      label: 'Min Avdeling',
      icon: '👥',
      subItems: [
        { id: 'ma-status', label: 'Status', icon: '📊' },
        { id: 'ma-walloffame', label: 'Wall of Fame MVP', icon: '👑' },
      ],
    },
    {
      id: 'mitt-prosjekt',
      label: 'Mitt Prosjekt',
      icon: '📦',
      subItems: [
        { id: 'mp-status', label: 'Status', icon: '📊' },
        { id: 'mp-walloffame', label: 'Wall of Fame MVP', icon: '👑' },
      ],
    },
    {
      id: 'teamleder',
      label: 'Teamleder',
      icon: '👨‍💼',
      subItems: [
        { id: 'tl-kalendere', label: 'Kalendere for team', icon: '📅' },
        { id: 'tl-selgere', label: 'Mine selgere', icon: '👤' },
      ],
      requiresAccess: (user: any) => user?.role === 'teamleder' || user?.role === 'owner',
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: '⚙️',
      subItems: [
        { id: 'admin-dashboard', label: 'Dashboard', icon: '📈' },
        { id: 'admin-organisasjon', label: 'Organisasjon', icon: '🏢' },
        {
          id: 'admin-allente',
          label: 'Allente',
          icon: '🏪',
          subItems: [
            { id: 'aa-salg', label: 'Salg', icon: '💳' },
            { id: 'aa-stats', label: 'Stats', icon: '📊' },
            { id: 'aa-angring', label: 'Angring', icon: '🔄' },
            { id: 'aa-mal', label: 'Mål', icon: '🎯' },
            { id: 'aa-progresjon', label: 'Progresjon', icon: '📈' },
            { id: 'aa-produkt', label: 'Produkt', icon: '📦' },
          ],
        },
        { id: 'admin-tema', label: 'Tema', icon: '🎨' },
      ],
      requiresAccess: (user: any) => user?.role === 'owner' || user?.role === 'admin',
    },
  ];

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleItemClick = (item: NavItem) => {
    if (item.subItems && item.subItems.length > 0) {
      toggleExpand(item.id);
      // Click first sub-item by default
      const firstSubItem = item.subItems[0];
      const [section, tab] = firstSubItem.id.split('-');
      onNavigate(item.id, firstSubItem.id);
    } else {
      const [section, tab] = item.id.split('-');
      onNavigate(item.id, item.id);
    }
  };

  const handleSubItemClick = (parentId: string, subItem: NavItem) => {
    onNavigate(parentId, subItem.id);
  };

  const renderNavItem = (item: NavItem, depth: number = 0) => {
    // Check access
    if (item.requiresAccess && !item.requiresAccess(user)) {
      return null;
    }

    const isExpanded = expandedItems.has(item.id);
    const hasSubItems = item.subItems && item.subItems.length > 0;

    return (
      <div key={item.id} className={`nav-item depth-${depth}`}>
        <button
          className={`nav-button ${currentSection === item.id ? 'active' : ''} ${hasSubItems ? 'has-submenu' : ''}`}
          onClick={() => handleItemClick(item)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
          {hasSubItems && (
            <span className={`nav-chevron ${isExpanded ? 'expanded' : ''}`}>▼</span>
          )}
        </button>

        {hasSubItems && isExpanded && (
          <div className={`nav-submenu submenu-depth-${depth + 1}`}>
            {item.subItems!.map(subItem => {
              const isNestedCollapsible = subItem.subItems && subItem.subItems.length > 0;
              const isSubExpanded = expandedItems.has(subItem.id);

              return (
                <div key={subItem.id}>
                  <button
                    className={`nav-subitem ${currentTab === subItem.id ? 'active' : ''} ${isNestedCollapsible ? 'collapsible' : ''}`}
                    onClick={() => {
                      if (isNestedCollapsible) {
                        toggleExpand(subItem.id);
                      } else {
                        handleSubItemClick(item.id, subItem);
                      }
                    }}
                  >
                    <span className="nav-icon">{subItem.icon}</span>
                    <span className="nav-label">{subItem.label}</span>
                    {isNestedCollapsible && (
                      <span className={`nav-chevron ${isSubExpanded ? 'expanded' : ''}`}>▼</span>
                    )}
                  </button>

                  {isNestedCollapsible && isSubExpanded && (
                    <div className="nav-nested-submenu">
                      {subItem.subItems!.map(nestedItem => (
                        <button
                          key={nestedItem.id}
                          className={`nav-nested-item ${currentTab === nestedItem.id ? 'active' : ''}`}
                          onClick={() => handleSubItemClick(item.id, nestedItem)}
                        >
                          <span className="nav-icon">{nestedItem.icon}</span>
                          <span className="nav-label">{nestedItem.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="navbar-accordion">
      <div className="nav-items">
        {navItems.map(item => renderNavItem(item, 0))}
      </div>

      <div className="nav-footer">
        <button className="nav-logout" onClick={onLogout}>
          🚪 Logout
        </button>
      </div>
    </nav>
  );
}
