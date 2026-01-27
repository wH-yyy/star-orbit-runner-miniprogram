// pages/record/record.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息
    userInfo: {
      _id: '',
      avatar: '',
      campus: '',
      class_name: '',
      college: '',
      createdTime: '',
      gender: '',
      name: '',
      openid: '',
      password: '',
      phone: '',
      status: '',
      stu_id: '',
      updateTime: '',
    },
    // 跑步记录列表
    recordList: [],
    // 统计数据
    totalCount: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalDistanceKm: '0.00',
    totalDurationMinutes: '0',
    // 加载状态
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo()
    this.loadRecords()
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      const app = getApp()
      // const stuId = app.globalData.userInfo?.stu_id || wx.getStorageSync('stu_id')
      const openid = app.globalData.userInfo.openid
      
      console.log('=== record.js loadUserInfo ===')
      console.log('全局userInfo:', app.globalData.userInfo)
      // console.log('本地存储stu_id:', wx.getStorageSync('stu_id'))
      // console.log('获取到的stuId:', stuId)
      console.log('本地存储openid:', wx.getStorageSync('openid'))
      console.log('获取到的openid:', openid)
      
      // if (!stuId) {
      if (!openid) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/phone-login/phone-login'
          })
        }, 1500)
        return
      }
      
      // 从数据库获取用户完整信息
      const db = wx.cloud.database()
      const res = await db.collection('Users')
        .where({
          // stu_id: stuId
          openid: openid
        })
        .get()
      
      console.log('数据库查询结果:', res)
      
      if (res.data.length > 0) {
        const userData = res.data[0]
        const totalDist = userData.totalDistance || 0
        const totalDur = userData.totalDuration || 0
        
        console.log('用户数据:', userData)
        console.log('设置userInfo为:', {
          _id: userData._id,
          avatar: userData.avatar || '/images/avatar.png',
          campus: userData.campus,
          class_name: userData.class_name,
          college: userData.college,
          createdTime: userData.createdTime,
          gender: userData.gender,
          name: userData.name,
          openid: userData.openid,
          password: userData.password,
          phone: userData.phone,
          status: userData.status,
          stu_id: userData.stu_id,
          updateTime: userData.updateTime 
        })
        
        this.setData({
          userInfo: {
            _id: userData._id,
            avatar: userData.avatar || '/images/avatar.png',
            campus: userData.campus,
            class_name: userData.class_name,
            college: userData.college,
            createdTime: userData.createdTime,
            gender: userData.gender,
            name: userData.name,
            openid: userData.openid,
            password: userData.password,
            phone: userData.phone,
            status: userData.status,
            stu_id: userData.stu_id,
            updateTime: userData.updateTime 
          },
          totalCount: userData.totalCount || 0,
          totalDistance: totalDist,
          totalDuration: totalDur,
          totalDistanceKm: (totalDist / 1000).toFixed(2),
          totalDurationMinutes: Math.round(totalDur / 60).toString()
        })
        
        console.log('设置后的data:', this.data)
      } else {
        // console.error('未找到用户数据，stuId:', stuId)
        console.error('未找到用户数据，openid:', openid)
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  /**
   * 加载跑步记录
   */
  async loadRecords() {
    try {
      this.setData({ loading: true })
      
      const app = getApp()
      // const stuId = app.globalData.userInfo?.stu_id || wx.getStorageSync('stu_id')
      const openid = app.globalData.userInfo.openid
      
      // if (!stuId) {
      if (!openid) {
        return
      }
      
      // 从数据库获取跑步记录
      const db = wx.cloud.database()
      const res = await db.collection('RunningRecords')
        .where({
          // stu_id: stuId
          openid: openid
        })
        .orderBy('create_time', 'desc')
        .get()
      
      this.setData({
        recordList: res.data,
        loading: false
      })
      
    } catch (error) {
      console.error('加载跑步记录失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时重新加载数据（防止从提交页面返回后数据不更新）
    this.loadUserInfo()
    this.loadRecords()
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    // 下拉刷新数据
    this.loadUserInfo()
    this.loadRecords()
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 上拉加载更多
    if (this.data.hasMore) {
      this.loadMoreData();
    }
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 加载模拟数据
   */
  loadMockData() {
    // 清空现有数据，显示加载状态
    this.setData({
      records: [],
      hasMore: false
    });
    
    // 模拟异步加载数据
    setTimeout(() => {
      // 模拟跑步打卡记录数据
      const mockRecords = [
        {
          id: '1',
          date: '2026-01-22',
          time: '07:30',
          type: 'gps',
          status: 'passed',
          distance: 5.2,
          duration: '28:35',
          pace: 5,
          paceSeconds: 30,
          steps: 6850
        },
        {
          id: '2',
          date: '2026-01-21',
          time: '18:45',
          type: 'manual',
          status: 'failed',
          failReason: '跑步距离未达到最低要求（需≥3km）',
          distance: 2.8,
          duration: '16:20',
          pace: 5,
          paceSeconds: 50,
          steps: 3800
        },
        {
          id: '3',
          date: '2026-01-20',
          time: '06:50',
          type: 'gps',
          status: 'passed',
          distance: 7.5,
          duration: '42:15',
          pace: 5,
          paceSeconds: 40,
          steps: 9800
        },
        {
          id: '4',
          date: '2026-01-19',
          time: '19:20',
          type: 'gps',
          status: 'pending',
          distance: 4.1,
          duration: '23:45',
          pace: 5,
          paceSeconds: 55,
          steps: 5400
        },
        {
          id: '5',
          date: '2026-01-18',
          time: '07:15',
          type: 'manual',
          status: 'passed',
          distance: 3.5,
          duration: '20:10',
          pace: 5,
          paceSeconds: 45,
          steps: 4600
        }
      ];

      this.setData({
        records: mockRecords,
        hasMore: true
      });
    }, 500);
  },

  /**
   * 加载更多数据
   */
  loadMoreData() {
    // 模拟加载更多数据
    setTimeout(() => {
      const newRecords = [
        {
          id: `more-${Date.now()}-1`,
          date: '2026-01-17',
          time: '18:30',
          type: 'gps',
          status: 'passed',
          distance: 6.3,
          duration: '35:20',
          pace: 5,
          paceSeconds: 35,
          steps: 8200
        },
        {
          id: `more-${Date.now()}-2`,
          date: '2026-01-16',
          time: '07:00',
          type: 'gps',
          status: 'failed',
          failReason: '跑步时长未达到最低要求（需≥15分钟）',
          distance: 3.2,
          duration: '14:50',
          pace: 4,
          paceSeconds: 45,
          steps: 4200
        }
      ];

      this.setData({
        records: [...this.data.records, ...newRecords],
        hasMore: false // 模拟没有更多数据
      });
    }, 1000);
  },

  /**
   * 查看记录详情
   */
  viewRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?id=${id}`
    });
  },


})