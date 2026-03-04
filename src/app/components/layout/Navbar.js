import React from 'react';
import { AppBar, Avatar, Badge, Box, Chip, IconButton, InputBase, Toolbar, Typography } from '@mui/material';
import { Bell, Menu, Search } from 'lucide-react';

const Navbar = ({ onToggleSidebar, user }) => {
	const isStudent = user?.role === 'student';
	const initials = (user?.name || 'User')
		.split(' ')
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();

	return (
		<AppBar
			position="static"
			elevation={0}
			sx={{
				backgroundColor: '#ffffff',
				color: '#111827',
				borderBottom: '1px solid #e5e7eb',
			}}
		>
			<Toolbar sx={{ minHeight: 64, px: isStudent ? 0 : 2 }}>
				<IconButton
					onClick={onToggleSidebar}
					edge="start"
					sx={{
						display: isStudent ? { xs: 'inline-flex', lg: 'none' } : { xs: 'inline-flex', lg: 'none' },
						mr: isStudent ? 0 : 1,
						borderRight: isStudent ? '1px solid #e5e7eb' : 'none',
						borderRadius: 0,
						width: isStudent ? 84 : 'auto',
						height: isStudent ? 64 : 'auto',
					}}
				>
					<Menu size={20} />
				</IconButton>

				{isStudent ? (
					<>
						<Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 2.5 }}>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									width: '100%',
									maxWidth: 480,
									height: 44,
									px: 1.5,
									borderRadius: 1,
									backgroundColor: '#f3f4f6',
									border: '1px solid #e5e7eb',
								}}
							>
								<Search size={18} color="#6b7280" />
								<InputBase placeholder="Search..." sx={{ width: '100%', fontSize: '1rem', color: '#111827' }} />
							</Box>
						</Box>

						<Box sx={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid #e5e7eb', pl: 2, pr: 2.5, height: 64, gap: 2 }}>
							<Badge badgeContent={3} color="error">
								<Bell size={20} color="#6b7280" />
							</Badge>
							<Box sx={{ borderLeft: '1px solid #e5e7eb', height: 36 }} />
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
								<Box sx={{ textAlign: 'right' }}>
									<Typography sx={{ fontWeight: 600, fontSize: '1rem', color: '#111827', lineHeight: 1 }}>{user?.name || 'Student User'}</Typography>
									<Chip label="Student" size="small" sx={{ mt: 0.5, backgroundColor: '#2563eb', color: '#fff', height: 22, fontWeight: 500 }} />
								</Box>
								<Avatar sx={{ width: 48, height: 48, bgcolor: '#2563eb', fontWeight: 600 }}>{initials}</Avatar>
							</Box>
						</Box>
					</>
				) : (
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<Typography sx={{ fontWeight: 600, fontSize: '1rem' }}>Academic Dashboard</Typography>
					</Box>
				)}
			</Toolbar>
		</AppBar>
	);
};

export default Navbar;
